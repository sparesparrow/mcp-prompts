#!/bin/bash

# Deploy web assets to S3 bucket
# Usage: ./scripts/deploy-web.sh <web-bucket-name>

set -e

WEB_BUCKET_NAME=$1

if [ -z "$WEB_BUCKET_NAME" ]; then
    echo "Usage: $0 <web-bucket-name>"
    echo "Example: $0 mcp-prompts-web-123456789012-us-east-1"
    exit 1
fi

echo "Deploying web assets to S3 bucket: $WEB_BUCKET_NAME"

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &>/dev/null; then
    echo "AWS CLI is not configured. Please configure it first."
    exit 1
fi

# Check if bucket exists
if ! aws s3 ls "s3://$WEB_BUCKET_NAME" &>/dev/null; then
    echo "Creating S3 bucket: $WEB_BUCKET_NAME"
    aws s3 mb "s3://$WEB_BUCKET_NAME"

    # Enable public access for web hosting
    aws s3api put-public-access-block \
        --bucket "$WEB_BUCKET_NAME" \
        --public-access-block-configuration "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"

    # Set bucket policy for public read access
    cat > /tmp/bucket-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::$WEB_BUCKET_NAME/*"
        }
    ]
}
EOF

    aws s3api put-bucket-policy --bucket "$WEB_BUCKET_NAME" --policy file:///tmp/bucket-policy.json
    rm /tmp/bucket-policy.json
else
    echo "Bucket $WEB_BUCKET_NAME already exists"
fi

# Upload web assets
echo "Uploading web assets..."
aws s3 sync web/ "s3://$WEB_BUCKET_NAME/" --delete

# Set cache control for static assets
aws s3 cp "s3://$WEB_BUCKET_NAME/" "s3://$WEB_BUCKET_NAME/" \
    --recursive \
    --metadata-directive REPLACE \
    --cache-control max-age=31536000 \
    --exclude "*.html" \
    --exclude "*.json"

# Set cache control for HTML files (no cache)
aws s3 cp "s3://$WEB_BUCKET_NAME/index.html" "s3://$WEB_BUCKET_NAME/index.html" \
    --metadata-directive REPLACE \
    --cache-control no-cache

echo "Web assets deployed successfully!"
echo "Your web app should be available at: https://$WEB_BUCKET_NAME.s3.amazonaws.com"

# Get CloudFront distribution if it exists
DISTRIBUTION_ID=$(aws cloudfront list-distributions --query "DistributionList.Items[?Origins.Items[?DomainName=='$WEB_BUCKET_NAME.s3.amazonaws.com']].Id" --output text 2>/dev/null || echo "")

if [ -n "$DISTRIBUTION_ID" ]; then
    echo "Invalidating CloudFront distribution: $DISTRIBUTION_ID"
    aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" --paths "/*"
    echo "CloudFront invalidation created"
fi