"""Document management endpoints (upload, list, delete)."""

import asyncio
import logging
from pathlib import Path
from tempfile import NamedTemporaryFile

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from langchain_openai import OpenAIEmbeddings

from app.config import EMBEDDING_MODEL, MAX_UPLOAD_BYTES
from app.database import get_stats, get_all_documents_with_chunks, delete_document
from app.dependencies import get_current_admin
from app.ingest import process_file
from app.schemas.documents import UploadResponse, DocumentInfo, RebuildResponse

log = logging.getLogger("pharmacy")

router = APIRouter(prefix="/documents", tags=["documents"])

_PDF_MAGIC = b"%PDF"


@router.post("/upload", response_model=UploadResponse)
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    admin: dict = Depends(get_current_admin),
):
    """Upload a PDF document for ingestion into the knowledge base."""
    rag_service = request.app.state.rag_service

    # C3a: sanitize filename — strip any path components
    safe_name = Path(file.filename or "").name
    if not safe_name or not safe_name.lower().endswith(".pdf"):
        docs, chunks = get_stats()
        return UploadResponse(
            success=False,
            message="Only PDF files are accepted.",
            doc_count=docs,
            chunk_count=chunks,
        )

    # C3b: verify PDF magic bytes before touching disk
    magic = await file.read(4)
    if magic != _PDF_MAGIC:
        docs, chunks = get_stats()
        return UploadResponse(
            success=False,
            message="File does not appear to be a valid PDF (missing %PDF header).",
            doc_count=docs,
            chunk_count=chunks,
        )
    await file.seek(0)

    tmp_path: Path | None = None
    try:
        # C3c: stream to temp file while enforcing size limit
        with NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            written = 0
            while True:
                chunk = await file.read(65_536)  # 64 KB chunks
                if not chunk:
                    break
                written += len(chunk)
                if written > MAX_UPLOAD_BYTES:
                    tmp_path = Path(tmp.name)
                    raise HTTPException(
                        status_code=413,
                        detail=f"File too large. Maximum allowed size is "
                               f"{MAX_UPLOAD_BYTES // (1024 * 1024)} MB.",
                    )
                tmp.write(chunk)
            tmp_path = Path(tmp.name)

        log.info(f"Upload by admin {admin['id']}: {safe_name} ({written:,} bytes)")

        emb = OpenAIEmbeddings(model=EMBEDDING_MODEL)
        # H8: process_file calls OpenAI (blocking HTTPS) — offload to thread
        # so the event loop is not blocked during embedding generation.
        success = await asyncio.to_thread(
            process_file, tmp_path, emb,
            uploaded_by=admin["id"],
            safe_name=safe_name,
        )

        docs, chunks = get_stats()
        if success:
            rag_service.reload_index()
            docs, chunks = get_stats()
            return UploadResponse(
                success=True,
                message=f"{safe_name} added successfully!",
                doc_count=docs,
                chunk_count=chunks,
            )

        return UploadResponse(
            success=False,
            message=f"{safe_name} is already in the database.",
            doc_count=docs,
            chunk_count=chunks,
        )

    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Upload error: {e}")
        docs, chunks = get_stats()
        return UploadResponse(
            success=False,
            message=f"Error: {type(e).__name__}",
            doc_count=docs,
            chunk_count=chunks,
        )
    finally:
        if tmp_path and tmp_path.exists():
            tmp_path.unlink()


@router.get("", response_model=list[DocumentInfo])
def list_documents(_admin: dict = Depends(get_current_admin)):
    """List all ingested documents including per-document chunk counts."""
    rows = get_all_documents_with_chunks()
    return [
        DocumentInfo(
            id=row[0],
            filename=row[1],
            page_count=row[4],
            file_size=row[3],
            chunk_count=row[6],
            created_at=row[5],
        )
        for row in rows
    ]


@router.delete("/{doc_id}", status_code=204)
def delete_document_endpoint(
    doc_id: int,
    request: Request,
    admin: dict = Depends(get_current_admin),
):
    """Delete a document and all its chunks, then reload the FAISS index."""
    rows = get_all_documents_with_chunks()
    if not any(row[0] == doc_id for row in rows):
        raise HTTPException(status_code=404, detail="Document not found.")

    delete_document(doc_id)
    request.app.state.rag_service.reload_index()
    log.info(f"Admin {admin['id']} deleted document id={doc_id}")


@router.post("/rebuild", response_model=RebuildResponse)
def rebuild_index(
    request: Request,
    admin: dict = Depends(get_current_admin),
):
    """Force-reload the FAISS index from the current database state."""
    request.app.state.rag_service.reload_index()
    docs, chunks = get_stats()
    log.info(f"Admin {admin['id']} triggered index rebuild: {docs} docs, {chunks} chunks")
    return RebuildResponse(success=True, doc_count=docs, chunk_count=chunks)
