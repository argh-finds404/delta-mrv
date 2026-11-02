FROM postgis/postgis:17-3.5

# pgvector for the bit(64) HNSW index (bit_hamming_ops needs >= 0.7.0)
RUN apt-get update \
    && apt-get install -y --no-install-recommends postgresql-17-pgvector \
    && rm -rf /var/lib/apt/lists/*
