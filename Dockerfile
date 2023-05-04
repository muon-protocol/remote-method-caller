FROM node:16.16.0

RUN mkdir -p /usr/src/app

WORKDIR /usr/src/app

COPY . /usr/src/app

#RUN npm install

EXPOSE 3002

# CMD npm start
