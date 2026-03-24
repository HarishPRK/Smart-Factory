# EC2 Setup Guide for Smart Factory

One-time setup steps for your Amazon Linux EC2 instance.

## Prerequisites

- EC2 instance running Amazon Linux 2023 (or Amazon Linux 2)
- SSH access to the instance
- Instance public IP or AWS public DNS

## Step 1: Configure Security Group

In AWS Console > EC2 > Security Groups > your instance's SG, add:

| Type | Protocol | Port | Source      |
|------|----------|------|-------------|
| HTTP | TCP      | 80   | 0.0.0.0/0  |

Ensure SSH (port 22) is restricted to your IP.

## Step 2: Install Nginx

SSH into your instance:

```bash
ssh -i your-key.pem ec2-user@<EC2-PUBLIC-IP>
```

Install and start Nginx:

```bash
sudo yum install -y nginx        # Amazon Linux 2
# sudo dnf install -y nginx      # Amazon Linux 2023

sudo systemctl start nginx
sudo systemctl enable nginx
```

Visit `http://<EC2-PUBLIC-IP>` to verify the default Nginx page loads.

## Step 3: Deploy the Nginx Configuration

From your **local machine**, copy the config:

```bash
scp -i your-key.pem deploy/nginx.conf ec2-user@<EC2-PUBLIC-IP>:/tmp/smart-factory.conf
```

Then on the **EC2 instance**:

```bash
# Install the smart-factory config
sudo mv /tmp/smart-factory.conf /etc/nginx/conf.d/smart-factory.conf

# Remove or comment out the default server block in /etc/nginx/nginx.conf
# Look for the "server {" block inside the http {} section and comment it out
sudo vi /etc/nginx/nginx.conf

# Create the web root
sudo mkdir -p /var/www/smart-factory
sudo chown -R nginx:nginx /var/www/smart-factory

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

## Step 4: Run the Deploy Script

Back on your **local machine** (Git Bash or WSL on Windows):

```bash
chmod +x deploy.sh
./deploy.sh ec2-user@<EC2-PUBLIC-IP> ~/.ssh/your-key.pem
```

## Step 5: Verify

Open `http://<EC2-PUBLIC-IP>` in your browser. The Smart Factory dashboard should load.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Connection refused on port 80 | Check Security Group inbound rules |
| 403 Forbidden | Check file ownership: `sudo chown -R nginx:nginx /var/www/smart-factory/` |
| Blank page | Check browser console; verify assets load from `/assets/` |
| Nginx config error | Run `sudo nginx -t` for details |
| `npm run build` fails locally | Ensure Node.js >= 18 is installed |
