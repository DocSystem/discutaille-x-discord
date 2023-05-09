FROM node:18

WORKDIR /app

COPY package.json /app
RUN npm install

ENV TOKEN=""

COPY . /app
CMD ["npm", "start"]
