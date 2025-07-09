process.env.AUTH_SECRET_KEY = 'test-secret-key';
process.env.BUCKET_CONFIGS = JSON.stringify([
  {
    "id": "main_r2",
    "name": "Main R2 Storage",
    "provider": "CLOUDFLARE_R2",
    "bindingName": "R2_MAIN_BUCKET",
    "allowedPaths": ["*"],
    "idWhitelist": ["test-user-id", "admin-user-id"]
  }
]);