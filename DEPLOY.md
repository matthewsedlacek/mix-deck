# Deploying MixDeck on AWS Lightsail

One small instance runs everything: Postgres, the API (which also serves the built app), and Caddy for HTTPS. Total cost ≈ $12/month.

## 1. Create the instance

1. In [Lightsail](https://lightsail.aws.amazon.com), **Create instance** → Linux, **Ubuntu 24.04 LTS**, the **$12/month plan (2 GB RAM)** — the smaller plans run out of memory building the app.
2. Under **Networking**, create and attach a **static IP**.
3. On the instance's **Networking** tab, edit the firewall:
   - Keep SSH (22) and HTTP (80); add **HTTPS (443)**.
   - Add **Custom TCP 5432**, restricted to *your home IP only* — this is what lets you develop against this database.

## 2. Install Docker and get the code

SSH in (browser terminal or `ssh ubuntu@<static-ip>`):

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu && exit   # re-SSH so the group applies
git clone <your-repo-url> mix-deck && cd mix-deck
```

(No GitHub repo yet? `git init --bare` on the instance and push to it, or `rsync` the project up — ask Claude to set this up.)

## 3. Configure and launch

```bash
cp .env.production.example .env
nano .env
```

- `POSTGRES_PASSWORD` and `JWT_SECRET`: paste output of `openssl rand -hex 32` (run it twice).
- `DOMAIN`: your domain (see step 4). No domain yet? `DOMAIN=:80` and `INSECURE_COOKIES=1` — the app works over plain HTTP at the static IP; switch to a real domain later.

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

First build takes a few minutes. The app container applies database migrations automatically on start. Visit `https://your-domain` (or `http://<static-ip>`).

## 4. Domain + HTTPS

Point an A record for your domain (e.g. `mix.example.com`) at the static IP, set `DOMAIN=mix.example.com` in `.env`, then `docker compose -f docker-compose.prod.yml up -d`. Caddy fetches and renews Let's Encrypt certificates automatically. Then set `INSECURE_COOKIES=0` if you'd changed it.

## 5. Develop locally against the deployed database

On your Mac, edit `server/.env`:

```
DATABASE_URL="postgresql://mixdeck:<POSTGRES_PASSWORD>@<static-ip>:5432/mixdeck"
```

Then `npm run dev` as usual — no local Postgres needed. Two things to know:

- **You're editing shared data.** Local dev and the deployed app use the same database — deleting a track locally deletes it for real.
- **Schema changes:** run `npm run db:migrate` locally (it migrates the remote DB), then redeploy the app (step 6) so the deployed code matches.
- If your home IP changes (ISPs rotate them), update the port-5432 firewall rule in Lightsail.

## 6. Updating the deployed app

```bash
ssh ubuntu@<static-ip>
cd mix-deck && git pull
docker compose -f docker-compose.prod.yml up -d --build
```

## Backups

Postgres data and uploads live in Docker volumes (`mixdeck_pgdata`, `mixdeck_uploads`). Lightsail **instance snapshots** ($0.05/GB/month) are the simplest backup: Snapshots tab → enable automatic daily snapshots. For belt-and-braces, dump the DB occasionally:

```bash
docker compose -f docker-compose.prod.yml exec db pg_dump -U mixdeck mixdeck > backup-$(date +%F).sql
```
