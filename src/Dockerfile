FROM denoland/deno:2.2.3
ENV DENO_CERT=./NSrootcaCert.pem
WORKDIR /app
COPY . .
RUN deno cache main.ts
CMD ["deno", "run", "--allow-read", "--allow-net", "--allow-env", "--env-file=prod.env", "main.ts"]
EXPOSE 80