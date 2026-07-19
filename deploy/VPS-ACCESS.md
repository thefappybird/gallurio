# VPS access

Use your key-only administrator account for interactive server access:

```powershell
ssh gallurio-admin@YOUR_VPS_IP
```

Replace `YOUR_VPS_IP` with the Hetzner server IPv4 address. This is the same
address stored as GitHub's `production` environment secret `VPS_HOST`.

## First-time host verification

Before accepting a new SSH host key, compare its ED25519 fingerprint with the
one shown in the Hetzner Console. Do not accept an unexpected changed key.

## Optional SSH shortcut

Add this to `%USERPROFILE%\.ssh\config` on your computer:

```sshconfig
Host gallurio-vps
  HostName YOUR_VPS_IP
  User gallurio-admin
  IdentityFile ~/.ssh/gallurio_admin
  IdentitiesOnly yes
```

Then log in with:

```powershell
ssh gallurio-vps
```

Keep private keys outside this repository. Use your personal admin key for
interactive access; do not copy GitHub Actions' deployment private key to your
computer. If your admin key has another filename, replace
`~/.ssh/gallurio_admin` with its actual path.

`gallurio` is separate: it is the restricted deployment user used by GitHub
Actions. Keep `VPS_USER=gallurio` in GitHub's `production` environment.
