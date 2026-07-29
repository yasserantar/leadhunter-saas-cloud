FROM node:20-alpine

# تثبيت الحزم اللازمة لـ Puppeteer ومحرك SQLite
RUN apk add --no-cache \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont \
      nodejs \
      npm \
      python3 \
      make \
      g++

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production

# نقل مجلد dist المحمي بدلاً من الكود المفتوح
COPY dist ./dist
# نقل المجلدات الأساسية التي لا تحتاج تشفير
COPY data ./data

EXPOSE 3000

CMD ["node", "dist/server/index.js"]
