# GCP Key Setup Guide

## Overview

The `gcp-key.json` file is a **Google Cloud Platform (GCP) service account key** that allows Terraform to authenticate with your GCP project and provision infrastructure. It contains credentials that grant permission to manage resources in your GCP project.

**Location:** The file should be placed at `/home/yassine/Desktop/sys_dist_cloud/3a_projet_systeme_distribue/gcp-key.json` (one level up from the `terraform/` directory).

---

## Why is it needed?

In your `terraform/main.tf` file (line 5), Terraform uses this file to authenticate:

```hcl
provider "google" {
  project     = var.project              # GCP Project ID: "sdtd-2"
  region      = var.region               # Region: "europe-west1"
  zone        = var.zone                 # Zone: "europe-west1-b"
  credentials = file("../gcp-key.json")  # ← Loads the key file
}
```

---

## GCP Key JSON Structure

The `gcp-key.json` file should contain a **service account key** in JSON format with the following structure:

```json
{
  "type": "service_account",
  "project_id": "sdtd-2",
  "private_key_id": "1234567890abcdef1234567890abcdef",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBA...[LONG ENCODED PRIVATE KEY]...Y8=\n-----END PRIVATE KEY-----\n",
  "client_email": "terraform-sa@sdtd-2.iam.gserviceaccount.com",
  "client_id": "1234567890",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/terraform-sa%40sdtd-2.iam.gserviceaccount.com"
}
```

### Field Descriptions

| Field | Description |
|-------|-------------|
| `type` | Always `"service_account"` |
| `project_id` | Your GCP project ID: `sdtd-2` |
| `private_key_id` | Unique identifier for the key |
| `private_key` | The actual private key (sensitive - keep secure!) |
| `client_email` | Service account email address |
| `client_id` | Numeric ID of the service account |
| `auth_uri` | Google's OAuth2 authorization endpoint |
| `token_uri` | Google's OAuth2 token endpoint |
| `auth_provider_x509_cert_url` | URL for certificate verification |
| `client_x509_cert_url` | Certificate URL for this service account |

---

## How to Generate the GCP Key

### Step 1: Navigate to GCP Console
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project: **sdtd-2**

### Step 2: Create a Service Account
1. Go to **IAM & Admin** → **Service Accounts**
2. Click **Create Service Account**
3. Fill in:
   - **Service account name:** `terraform-sa` (or similar)
   - **Service account ID:** auto-filled
   - **Description:** `Terraform service account for infrastructure provisioning`
4. Click **Create and Continue**

### Step 3: Grant Permissions
1. In the **Grant this service account access to project** section, assign these roles:
   - **Compute Admin** (for VM instances)
   - **Kubernetes Engine Admin** (for GKE clusters)
   - **Service Account User** (to use other service accounts)
   - **Cloud Dataproc Admin** (if using Dataproc)
2. Click **Continue**
3. Click **Done**

### Step 4: Generate the Key
1. Open the newly created service account
2. Go to the **Keys** tab
3. Click **Add Key** → **Create new key**
4. Select **JSON** as the key type
5. Click **Create**
6. A `[account-name]-[id].json` file will download automatically

### Step 5: Place the Key File
1. Rename the downloaded file to `gcp-key.json`
2. Place it in the project root directory:
   ```
   /home/yassine/Desktop/sys_dist_cloud/3a_projet_systeme_distribue/gcp-key.json
   ```

---

## Security Best Practices

 **IMPORTANT:** The `gcp-key.json` file contains **sensitive credentials**. Follow these security practices:

### Do's:
 Add `gcp-key.json` to `.gitignore` to prevent accidental commits
```bash
echo "gcp-key.json" >> .gitignore
```

 Keep file permissions restricted:
```bash
chmod 600 gcp-key.json
```

 Use environment variables or secret management systems in production
 Rotate keys regularly (every 90 days recommended)
 Monitor service account activity in GCP console

### Don'ts:
 **Never** commit `gcp-key.json` to version control
 **Never** share the key via email or messaging
 **Never** hardcode credentials in code
 **Never** commit keys to public repositories

---

## Troubleshooting

### Error: "credentials are invalid"
- Verify the service account has the required roles assigned
- Check that the `project_id` in the key matches your GCP project ID

### Error: "file not found"
- Ensure `gcp-key.json` is in the correct location (project root, not in `terraform/` folder)
- Verify the path in `terraform/main.tf` is correct: `../gcp-key.json`

### Error: "Permission denied" when running Terraform
- Ensure the service account has appropriate IAM roles assigned
- Run `terraform init` again to refresh credentials

---

## Environment Variable Alternative

Instead of file-based authentication, you can use an environment variable:

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/gcp-key.json"
```

Then modify `terraform/main.tf`:
```hcl
provider "google" {
  project = var.project
  region  = var.region
  zone    = var.zone
  # credentials file is loaded from GOOGLE_APPLICATION_CREDENTIALS env var
}
```

---

## Using the Key with Terraform

Once the key is in place, Terraform can be used as normal:

```bash
cd terraform/
terraform init      # Initialize Terraform (loads the key)
terraform plan     # Preview changes
terraform apply    # Deploy infrastructure
```

The service account will have permissions to:
- Create/manage Compute Engine instances (Gateway, Masters, Workers)
- Create VPC networks and firewalls
- Manage other GCP resources as defined in your Terraform files

---

## Project Context

Your Terraform configuration deploys a **Kubernetes cluster on GCP** with:
- **1 Gateway (Bastion)** - SSH access point
- **Master nodes** - Kubernetes control plane
- **Worker nodes** - Kubernetes compute nodes
- **VPC Network** - Custom network (10.240.0.0/24)
- **Firewalls** - SSH, web traffic, internal communication
- **Cloud NAT** - Outbound internet access

All of this requires the service account to have sufficient permissions via the `gcp-key.json` credentials.

---

## Reference Links

- [GCP Service Accounts Documentation](https://cloud.google.com/iam/docs/service-accounts)
- [Terraform Google Provider Documentation](https://registry.terraform.io/providers/hashicorp/google/latest/docs)
- [Creating and Managing Service Account Keys](https://cloud.google.com/iam/docs/creating-managing-service-account-keys)
