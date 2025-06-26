export type Bindings = {
  // Allow accessing dynamically configured bucket-related environment variables via string index
  [key: string]: any;

  /**
   * Default bucket configuration name to use
   * @example "personal_aws"
   * @example "main_r2"
   */
  DEFAULT_BUCKET_CONFIG_NAME?: string;

  /**
   * Dynamic bucket configuration - using prefix pattern
   * Format: BUCKET_{logical_name}_{attribute_name}
   * 
   * Example configuration:
   * - BUCKET_personal_aws_PROVIDER: "AWS_S3"
   * - BUCKET_personal_aws_ACCESS_KEY_ID: "..."
   * - BUCKET_personal_aws_SECRET_ACCESS_KEY: "..."
   * - BUCKET_personal_aws_BUCKET_NAME: "my-bucket"
   * - BUCKET_personal_aws_REGION: "us-east-1"
   * - BUCKET_personal_aws_ENDPOINT: "https://s3.amazonaws.com"
   * - BUCKET_personal_aws_CUSTOM_DOMAIN: "https://images.example.com"
   * - BUCKET_personal_aws_ALIAS: "Personal Image Storage"
   * - BUCKET_personal_aws_ALLOWED_PATHS: "images,documents,uploads"
   * 
   * - BUCKET_main_r2_PROVIDER: "CLOUDFLARE_R2"
   * - BUCKET_main_r2_BINDING_NAME: "R2_MAIN_BINDING"
   * - BUCKET_main_r2_ALIAS: "Main File Storage"
   * - BUCKET_main_r2_ALLOWED_PATHS: "*" or "public,assets"
   */

  /**
   * Cloudflare R2 Bucket bindings (dynamic bindings)
   * These are bindings configured in r2_buckets in wrangler.jsonc
   */
  R2_BUCKET?: R2Bucket;

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
   * Custom access domain (global default)
   * @example "https://images.mycompany.com"
   * @deprecated Please use BUCKET_{name}_CUSTOM_DOMAIN instead
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

/**
 * Configuration information for a single bucket
 */
export type BucketConfig = {
  provider: 'CLOUDFLARE_R2' | 'AWS_S3';
  bucketName?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  region?: string;
  endpoint?: string;
  customDomain?: string;
  bindingName?: string; // Only for Cloudflare R2
  alias?: string; // Bucket alias for user-friendly display
  allowedPaths?: string[]; // List of allowed paths, e.g. ["images", "documents"] or ["*"] for all paths
}; 