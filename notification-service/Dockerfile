FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Явно передаем путь к конфигу, чтобы tsc не выплевывал справку
RUN ./node_modules/.bin/tsc -p tsconfig.json

ENV NODE_ENV=production

CMD ["npm", "run", "start"]