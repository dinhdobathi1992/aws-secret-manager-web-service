# AWS Secrets Manager Web Service Helm Chart

## Prerequisites

- Kubernetes cluster with AWS ALB Ingress Controller
- AWS IAM OIDC provider configured
- SSL certificate in AWS Certificate Manager
- Azure AD application configured

## Installation

1. Copy the example values file:

```bash
cp values.example.yaml values.yaml
```

2. Update values.yaml with your configuration:

- AWS Account ID and role names
- Azure AD credentials
- Domain name and SSL certificate ARN
- Service account role ARN

3. Install the chart:

```bash
helm install aws-secrets-manager . -f values.yaml
```

## Configuration

### Required Values

- `serviceAccount.annotations.eks.amazonaws.com/role-arn`: AWS IAM role ARN
- `ingress.annotations.alb.ingress.kubernetes.io/certificate-arn`: SSL certificate ARN
- `secrets.azure`: Azure AD credentials
- `configMap.AWS_ACCOUNTS`: AWS account configurations

### Optional Values

- `replicaCount`: Number of pod replicas
- `resources`: CPU and memory limits
- `ingress.annotations`: Additional ingress annotations

## Security Notes

- Never commit values.yaml with secrets to version control
- Use secrets management solutions for production deployments
- Rotate Azure AD and AWS credentials regularly

## AWS IAM Setup

### 1. Create IAM Role

Create an IAM role with the following permissions policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:ListSecrets",
        "secretsmanager:CreateSecret",
        "secretsmanager:UpdateSecret",
        "secretsmanager:DeleteSecret"
      ],
      "Resource": "*"
    }
  ]
}
```

### 2. Configure Trust Relationship

Update the role's trust relationship to allow EKS service account to assume the role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<AWS_ACCOUNT_ID>:oidc-provider/oidc.eks.<REGION>.amazonaws.com/id/<OIDC_ID>"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "oidc.eks.<REGION>.amazonaws.com/id/<OIDC_ID>:sub": "system:serviceaccount:<NAMESPACE>:aws-sm-service",
          "oidc.eks.<REGION>.amazonaws.com/id/<OIDC_ID>:aud": "sts.amazonaws.com"
        }
      }
    }
  ]
}
```

### 3. Get EKS OIDC Provider

Get your cluster's OIDC provider URL:

```bash
# Get OIDC provider URL
aws eks describe-cluster --name <CLUSTER_NAME> --query "cluster.identity.oidc.issuer" --output text

# Extract OIDC ID
OIDC_ID=$(aws eks describe-cluster --name <CLUSTER_NAME> --query "cluster.identity.oidc.issuer" --output text | cut -d'/' -f5)
```

### 4. Update Role Trust Policy

```bash
# Create trust policy file
cat > trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<AWS_ACCOUNT_ID>:oidc-provider/oidc.eks.<REGION>.amazonaws.com/id/${OIDC_ID}"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "oidc.eks.<REGION>.amazonaws.com/id/${OIDC_ID}:sub": "system:serviceaccount:<NAMESPACE>:aws-sm-service",
          "oidc.eks.<REGION>.amazonaws.com/id/${OIDC_ID}:aud": "sts.amazonaws.com"
        }
      }
    }
  ]
}
EOF

# Update role trust relationship
aws iam update-assume-role-policy \
  --role-name aws-sm-service \
  --policy-document file://trust-policy.json
```

Replace the following placeholders:

- `<AWS_ACCOUNT_ID>`: Your AWS account ID
- `<REGION>`: AWS region (e.g., ap-southeast-1)
- `<CLUSTER_NAME>`: Your EKS cluster name
- `<NAMESPACE>`: Kubernetes namespace where the app is deployed
- `<OIDC_ID>`: OIDC provider ID from step 3
