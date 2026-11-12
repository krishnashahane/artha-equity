# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim

# The production Python engine is dependency-free; only the interpreter is needed.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 ca-certificates tini \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --chown=node:node . .
RUN node scripts/build.mjs \
 && mkdir -p /app/data/runtime /app/data/processed \
 && chown -R node:node /app/data /app/dist

USER node
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 PYTHON_EXECUTABLE=/usr/bin/python3
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/tini","--"]
CMD ["node","backend/server.mjs"]
