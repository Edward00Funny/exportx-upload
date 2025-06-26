export type Bindings = {
  /**
   * Cloudflare R2 Bucket binding.
   * This is automatically provided by the Cloudflare platform.
   * In wrangler.jsonc, you should have something like:
   * [[r2_buckets]]
   * binding = "R2_BUCKET"
   * bucket_name = "my-bucket-name"
   */
  R2_BUCKET: R2Bucket;

  /**
   * Storage provider type.
   * @example "CLOUDFLARE_R2"
   * @example "AWS_S3"
   */
  STORAGE_PROVIDER: 'CLOUDFLARE_R2' | 'AWS_S3';

  // --- S3 compatible storage configuration ---
  /**
   * S3 compatible storage Access Key
   * @example "your_ak_string"
   */
  S3_ACCESS_KEY_ID?: string;

  /**
   * S3 compatible storage Secret Key
   * @example "your_sk_string"
   */
  S3_SECRET_ACCESS_KEY?: string;

  /**
   * S3 compatible storage bucket name
   * @example "my-image-bucket"
   */
  S3_BUCKET_NAME?: string;

  /**
   * S3 compatible storage endpoint
   * @example "https://<accountid>.r2.cloudflarestorage.com"
   */
  S3_ENDPOINT?: string;

  /**
   * S3 compatible storage region
   * @example "us-east-1"
   */
  S3_REGION?: string;

  // --- Authentication configuration ---
  /**
   * Authentication type
   * @example "TOKEN"
   * @example "TOKEN_AND_EMAIL_WHITELIST"
   */
  AUTH_TYPE: 'TOKEN' | 'TOKEN_AND_EMAIL_WHITELIST';

  /**
   * Shared authentication secret key for verifying request legitimacy
   * @example "a_very_long_and_secure_string"
   */
  AUTH_SECRET_KEY: string;

  /**
   * Email whitelist (comma-separated)
   * Required when AUTH_TYPE is TOKEN_AND_EMAIL_WHITELIST
   * @example "user1@co.com,user2@co.com"
   */
  EMAIL_WHITELIST?: string;

  // --- Additional configuration ---
  /**
   * Custom access domain
   * @example "https://images.mycompany.com"
   */
  CUSTOM_DOMAIN?: string;

  /**
   * Allowed cross-origin request sources
   * @example "https://www.figma.com"
   */
  ALLOWED_ORIGINS?: string;

  /**
   * Node.js server listening port (Docker only)
   * @example "8080"
   */
  PORT?: string;
}; 