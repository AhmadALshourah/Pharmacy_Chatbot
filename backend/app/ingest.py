"""
Ingest PDF files into the pharmacy SQLite database.

Usage:
    python -m app.ingest                          # Ingest all PDFs in data/pdfs/
    python -m app.ingest file1.pdf file2.pdf      # Ingest specific files
    python -m app.ingest --dir path/to/folder     # Ingest all PDFs from a folder
    python -m app.ingest --list                   # List all ingested documents
    python -m app.ingest --delete "Aspirin.pdf"   # Remove a document by name
"""

import argparse
import logging
from pathlib import Path
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv())

from PyPDF2 import PdfReader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from app.config import EMBEDDING_MODEL, FAISS_INDEX_PATH, FAISS_META_PATH, PDFS_DIR

log = logging.getLogger("pharmacy")

from app.database import (
    init_db,
    compute_file_hash,
    document_exists_by_hash,
    ingest_document,
    get_all_documents,
    delete_document,
    get_stats,
)

SPLITTER = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200,
    length_function=len,
    separators=["\n\n", "\n", ". ", " ", ""],
)


def extract_text(pdf_path):
    reader = PdfReader(pdf_path)
    pages_text = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            pages_text.append(text)
    return "\n".join(pages_text), len(reader.pages)


def process_file(filepath, embeddings, uploaded_by: int | None = None, safe_name: str | None = None):
    """Ingest a single PDF.

    Args:
        filepath:    Path to the (possibly temporary) PDF file on disk.
        embeddings:  OpenAI embeddings instance.
        uploaded_by: Admin ID for attribution (None = CLI).
        safe_name:   Override the stored filename (used by the upload router which
                     has already sanitized the original filename via Path(...).name).
                     Defaults to the basename of *filepath*.
    """
    filepath = Path(filepath)

    if not filepath.exists():
        print(f"  [!] File not found: {filepath}")
        return False

    if filepath.suffix.lower() != ".pdf":
        print(f"  [!] Not a PDF: {filepath}")
        return False

    stored_name = safe_name or filepath.name
    file_hash = compute_file_hash(filepath)

    if document_exists_by_hash(file_hash):
        print(f"  [=] Already ingested: {filepath.name}")
        return False

    print(f"  [>] Processing: {stored_name}")

    try:
        raw_text, page_count = extract_text(filepath)
    except Exception as e:
        print(f"  [!] Failed to read PDF ({type(e).__name__}): {filepath.name}")
        return False

    if not raw_text.strip():
        print(f"  [!] No text extracted (possibly a scanned/image PDF): {filepath.name}")
        return False

    chunks = SPLITTER.split_text(raw_text)
    print(f"      {page_count} pages -> {len(chunks)} chunks")

    try:
        print("      Generating embeddings...")
        vectors = embeddings.embed_documents(chunks)
    except Exception as e:
        print(f"  [!] Embedding failed ({type(e).__name__}): {e}")
        return False

    chunks_data = [(i, text, vec) for i, (text, vec) in enumerate(zip(chunks, vectors))]

    try:
        ingest_document(stored_name, file_hash, filepath.stat().st_size, page_count, chunks_data, uploaded_by)
    except Exception as e:
        print(f"  [!] Database error ({type(e).__name__}): {e}")
        return False

    print("      Stored in database")
    return True


def auto_ingest_pdfs(pdfs_dir: Path | None = None) -> int:
    """Scan a directory for PDFs and ingest any not already in the database.

    Called at startup from main.py lifespan. Uses logging instead of print().
    Skips files already ingested (SHA256 hash dedup via process_file).

    Returns the number of newly ingested documents.
    """
    target_dir = pdfs_dir or PDFS_DIR

    if not target_dir.exists():
        log.info(f"Auto-ingest: directory does not exist, skipping: {target_dir}")
        return 0

    pdf_files = sorted(target_dir.glob("*.pdf"))
    if not pdf_files:
        log.info(f"Auto-ingest: no PDF files found in {target_dir}")
        return 0

    log.info(f"Auto-ingest: scanning {len(pdf_files)} PDF(s) in {target_dir}")

    embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL)
    added = 0

    for pdf_path in pdf_files:
        try:
            if process_file(pdf_path, embeddings):
                added += 1
                log.info(f"Auto-ingest: ingested {pdf_path.name}")
        except Exception as e:
            log.error(f"Auto-ingest: failed to process {pdf_path.name}: {type(e).__name__}: {e}")

    if added > 0:
        log.info(f"Auto-ingest: {added} new document(s) ingested")
    else:
        log.info("Auto-ingest: all files already in database, nothing new to ingest")

    return added


def cmd_ingest(paths):
    embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL)
    added = 0

    for p in paths:
        if process_file(p, embeddings):
            added += 1

    # Invalidate FAISS cache so the app rebuilds on next start
    if added > 0:
        for cache_file in (FAISS_INDEX_PATH, FAISS_META_PATH):
            if cache_file.exists():
                cache_file.unlink()

    docs, chunks = get_stats()
    print(f"\n  Done: {added} new document(s) added.")
    print(f"  Database: {docs} document(s), {chunks} chunk(s) total.")


def cmd_ingest_dir(directory):
    directory = Path(directory)
    if not directory.exists():
        print(f"  [!] Directory not found: {directory}")
        return

    pdfs = sorted(directory.glob("*.pdf"))
    if not pdfs:
        print(f"  [!] No PDF files in: {directory}")
        return

    print(f"  Found {len(pdfs)} PDF(s) in {directory}/\n")
    cmd_ingest(pdfs)


def cmd_list():
    docs = get_all_documents()
    if not docs:
        print("  No documents in database.")
        return

    print(f"\n  {'ID':<5} {'Filename':<30} {'Pages':<7} {'Size':<12} {'Added'}")
    print(f"  {'-'*5} {'-'*30} {'-'*7} {'-'*12} {'-'*19}")

    for doc_id, filename, _, file_size, page_count, created_at in docs:
        size_str = f"{file_size / 1024:.1f} KB" if file_size < 1048576 else f"{file_size / 1048576:.1f} MB"
        print(f"  {doc_id:<5} {filename:<30} {page_count:<7} {size_str:<12} {created_at}")

    doc_count, chunk_count = get_stats()
    print(f"\n  Total: {doc_count} document(s), {chunk_count} chunk(s)")


def cmd_delete(filename):
    docs = get_all_documents()
    target = None
    for doc in docs:
        if doc[1] == filename:
            target = doc
            break

    if not target:
        print(f"  [!] Document not found: {filename}")
        return

    delete_document(target[0])
    print(f"  [x] Deleted: {filename}")


def main():
    parser = argparse.ArgumentParser(description="Ingest PDF files into the pharmacy database")
    parser.add_argument("files", nargs="*", help="PDF files to ingest")
    parser.add_argument("--dir", type=str, help="Directory containing PDFs to ingest")
    parser.add_argument("--list", action="store_true", help="List all ingested documents")
    parser.add_argument("--delete", type=str, metavar="FILENAME", help="Delete a document by filename")

    args = parser.parse_args()

    init_db()

    if args.list:
        cmd_list()
    elif args.delete:
        cmd_delete(args.delete)
    elif args.dir:
        cmd_ingest_dir(args.dir)
    elif args.files:
        cmd_ingest(args.files)
    else:
        # Default: ingest all PDFs from data/pdfs/
        cmd_ingest_dir(PDFS_DIR)


if __name__ == "__main__":
    main()
