FROM node:22-alpine
WORKDIR /app
COPY . .
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/app/data \
    TRUST_PROXY=1
# La base SQLite vit dans /app/data : montez-y un volume persistant
VOLUME ["/app/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:3000/healthz || exit 1
CMD ["node", "server/index.js"]
