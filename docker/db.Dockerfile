FROM postgis/postgis:18-3.6

# Same major as the Neon dev branch (PostgreSQL 18, PostGIS 3.6).
# pgvector for the bit(64) HNSW index (bit_hamming_ops needs >= 0.7.0)
RUN apt-get update \
    && apt-get install -y --no-install-recommends postgresql-18-pgvector \
    && rm -rf /var/lib/apt/lists/*
