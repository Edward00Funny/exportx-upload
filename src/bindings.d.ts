export type Bindings = {
  // Allow accessing dynamically configured bucket-related environment variables via string index
  [key: string]: any;

  /**
   * Bucket configuration using JSON format
   * 
   * Set BUCKET_CONFIGS environment variable with JSON array:
   * 
   * Example configuration:
   * BUCKET_CONFIGS='[
   *   {
   *     "id": "personal_aws",
   *     "name": "Personal AWS Storage",
   *     "provider": "AWS_S3",
   *     "bucketName": "my-personal-bucket",
   *     "accessKeyId": "your-access-key",
   *     "secretAccessKey": "your-secret-key",
   *     "region": "us-east-1",
   *     "endpoint": "https://s3.amazonaws.com",
   *     "customDomain": "https://images.example.com",
   *     "allowedPaths": ["images", "documents"],
   *     "idWhitelist": ["user1", "user2"]
   *   },
   *   {
   *     "id": "main_r2",
   *     "name": "Main R2 Storage",
   *     "provider": "CLOUDFLARE_R2",
   *     "bindingName": "R2_MAIN_BINDING",
   *     "customDomain": "https://files.example.com",
   *     "allowedPaths": ["*"],
   *     "idWhitelist": ["admin"]
   *   }
   * ]'
   * 
   * This replaces the old environment variable pattern:
   * BUCKET_{logical_name}_{attribute_name}
   */
  BUCKET_CONFIGS?: string;

  /**
   * Cloudflare R2 Bucket bindings (dynamic bindings)
   * These are bindings configured in r2_buckets in wrangler.jsonc
   */
  R2_BUCKET?: R2Bucket;

  // --- Authentication configuration ---
  /**
   * Shared authentication secret key for verifying request legitimacy
   * @example "a_very_long_and_secure_string"
   */
  AUTH_SECRET_KEY: string;

  // --- Additional configuration ---
  /**
   * Custom access domain (global default)
   * @example "https://images.mycompany.com"
   * @deprecated Please use BUCKET_{name}_CUSTOM_DOMAIN instead
   */
  CUSTOM_DOMAIN?: string;

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
  id: string; // Unique identifier for the bucket configuration
  name?: string; // User-friendly display name
  provider: 'CLOUDFLARE_R2' | 'AWS_S3';
  bucketName?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  region?: string;
  endpoint?: string;
  customDomain?: string;
  bindingName?: string; // Only for Cloudflare R2
  allowedPaths?: string[]; // List of allowed paths, e.g. ["images", "documents"] or ["*"] for all paths
  idWhitelist?: string[]; // ID whitelist for this bucket
};
