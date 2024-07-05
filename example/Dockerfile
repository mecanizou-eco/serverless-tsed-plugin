FROM node:21-alpine

RUN apk --no-cache add git \
    groff \
    less \
    python3 \
    py3-pip \
    postgresql-libs \
    postgresql-client \
    postgresql-dev \
    build-base

RUN ln -sf python3 /usr/bin/python

RUN python3 -m venv /venv
ENV PATH="/venv/bin:$PATH"

RUN pip3 install --upgrade pip
RUN pip3 install --no-cache-dir awscli

RUN npm install -g serverless

WORKDIR /usr/src/app

COPY package*.json ./

COPY . .

RUN git --version

RUN npm install