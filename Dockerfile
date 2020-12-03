FROM ubuntu:20.04

RUN apt-get update 

RUN DEBIAN_FRONTEND=noninteractive \
    TZ=Asia/Singapore \
    apt-get install \
    nodejs \
    npm \
    --yes

WORKDIR /app

COPY package.* .

COPY . .

CMD ["npm", "run", "dev"]
