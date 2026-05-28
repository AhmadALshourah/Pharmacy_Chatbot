import pytest


@pytest.fixture
def tmp_db(tmp_path, monkeypatch):
    """Provide a clean temporary database for each test."""
    db_file = tmp_path / "test_pharmacy.db"
    monkeypatch.setattr("app.database.DB_PATH", db_file)
    from app.database import init_db
    init_db()
    return db_file
