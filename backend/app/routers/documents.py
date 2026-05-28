"""Document management endpoints (upload, list, delete)."""

import logging
import shutil
from pathlib import Path
from tempfile import NamedTemporaryFile

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from langchain_openai import OpenAIEmbeddings

from app.config import EMBEDDING_MODEL
from app.database import get_stats, get_all_documents, delete_document
from app.dependencies import get_current_admin
from app.ingest import process_file
from app.schemas.documents import UploadResponse, DocumentInfo, RebuildResponse

log = logging.getLogger("pharmacy")

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("/upload", response_model=UploadResponse)
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    admin: dict = Depends(get_current_admin),
):
    """Upload a PDF document for ingestion into the knowledge base."""
    rag_service = request.app.state.rag_service

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        docs, chunks = get_stats()
        return UploadResponse(
            success=False,
            message="Only PDF files are accepted.",
            doc_count=docs,
            chunk_count=chunks,
        )

    tmp_path: Path | None = None
    try:
        suffix = Path(file.filename).suffix
        with NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = Path(tmp.name)

        log.info(f"Upload by admin {admin['id']}: {file.filename}")

        emb = OpenAIEmbeddings(model=EMBEDDING_MODEL)
        success = process_file(tmp_path, emb, uploaded_by=admin["id"])

        if success:
            rag_service.reload_index()
            docs, chunks = get_stats()
            return UploadResponse(
                success=True,
                message=f"{file.filename} added successfully!",
                doc_count=docs,
                chunk_count=chunks,
            )

        docs, chunks = get_stats()
        return UploadResponse(
            success=False,
            message=f"{file.filename} is already in the database.",
            doc_count=docs,
            chunk_count=chunks,
        )

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
async def list_documents(_admin: dict = Depends(get_current_admin)):
    """List all ingested documents."""
    rows = get_all_documents()
    return [
        DocumentInfo(
            id=row[0],
            filename=row[1],
            page_count=row[4],
            file_size=row[3],
            created_at=row[5],
        )
        for row in rows
    ]


@router.delete("/{doc_id}", status_code=204)
async def delete_document_endpoint(
    doc_id: int,
    request: Request,
    admin: dict = Depends(get_current_admin),
):
    """Delete a document and all its chunks, then reload the FAISS index."""
    rows = get_all_documents()
    if not any(row[0] == doc_id for row in rows):
        raise HTTPException(status_code=404, detail="Document not found.")

    delete_document(doc_id)
    request.app.state.rag_service.reload_index()
    log.info(f"Admin {admin['id']} deleted document id={doc_id}")


@router.post("/rebuild", response_model=RebuildResponse)
async def rebuild_index(
    request: Request,
    admin: dict = Depends(get_current_admin),
):
    """Force-reload the FAISS index from the current database state."""
    request.app.state.rag_service.reload_index()
    docs, chunks = get_stats()
    log.info(f"Admin {admin['id']} triggered index rebuild: {docs} docs, {chunks} chunks")
    return RebuildResponse(success=True, doc_count=docs, chunk_count=chunks)
