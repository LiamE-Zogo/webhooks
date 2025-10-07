ALTER TABLE webhooks ADD COLUMN callback_url VARCHAR(510) NULL;

CREATE TABLE IF NOT EXISTS run_log (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  webhook_id INT NOT NULL,
  response_text VARCHAR(1024) NOT NULL,
  response_code SMALLINT NOT NULL,
  response_time SMALLINT NOT NULL,
  FOREIGN KEY (webhook_id) REFERENCES webhooks(id)
);

DROP TABLE errors;