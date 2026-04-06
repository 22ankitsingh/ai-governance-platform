import logging
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import settings

logger = logging.getLogger(__name__)

# PostgreSQL (NeonDB) — no SQLite-specific connect_args needed
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    future=True,
    # asyncpg pool settings — safe for NeonDB serverless
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,  # reconnect on stale connections
)

async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    logger.info("Initializing database schema (PostgreSQL / NeonDB)...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database schema initialized")
