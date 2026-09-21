# ---- 1단계: 빌드 ----
    FROM node:20-bookworm-slim AS builder

    WORKDIR /app
    
    COPY package*.json ./
    RUN npm ci
    
    COPY prisma ./prisma
    RUN npx prisma generate
    
    COPY tsconfig.json ./
    COPY src ./src
    RUN npm run build
    
    # ---- 2단계: 런타임 ----
    FROM node:20-bookworm-slim AS runner
    
    WORKDIR /app
    ENV NODE_ENV=production
    
    # masking(cv2) 실행에 필요한 시스템 라이브러리 + python3
    RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 python3-venv python3-pip \
        libgl1 libglib2.0-0 \
        && rm -rf /var/lib/apt/lists/*
    
    COPY package*.json ./
    RUN npm ci --omit=dev
    
    COPY --from=builder /app/dist ./dist
    COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
    COPY prisma ./prisma
    COPY masking ./masking
    
    # masking 전용 파이썬 가상환경 구성
    RUN python3 -m venv /app/masking/.venv \
        && /app/masking/.venv/bin/pip install --no-cache-dir -r masking/requirements.txt
    
    RUN mkdir -p /app/uploads/img
    
    EXPOSE 5000
    
    CMD ["node", "dist/app.js"]