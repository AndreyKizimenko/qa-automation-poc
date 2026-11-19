#!/usr/bin/env bash
# Puts kind, Helm and kubectl on the runner's PATH at pinned versions, each checked against the SHA-256
# pinned here, so a run never picks up whatever a runner image or a CDN serves that day. Linux amd64
# only (GitHub's hosted runners). The versions are the ones the setup was built and tried with
# (2026-11-19); kubectl matches the Kubernetes of kind's default node image.
set -euo pipefail

kind_version=v0.33.0
kind_sha256=aee6151561422756b764a4ae28e7f44cda5af5a9eead3cc9985112b1de8d8e0d
helm_version=v4.1.4
helm_sha256=70b2c30a19da4db264dfd68c8a3664e05093a361cefd89572ffb36f8abfa3d09
kubectl_version=v1.37.0
kubectl_sha256=6129359f4e1f3848a5572ccb0b26cf28b8ca08cef38c95a765b2f64a2c961a2f

bin="${RUNNER_TEMP:?}/k8s-tools"
mkdir -p "$bin"
cd "$bin"

fetch() { # <url> <file> <sha256>
  curl -fsSL --retry 3 -o "$2" "$1"
  echo "$3  $2" | sha256sum --check --strict
}

fetch "https://github.com/kubernetes-sigs/kind/releases/download/$kind_version/kind-linux-amd64" kind "$kind_sha256"
fetch "https://get.helm.sh/helm-$helm_version-linux-amd64.tar.gz" helm.tar.gz "$helm_sha256"
tar -xzf helm.tar.gz --strip-components=1 linux-amd64/helm
fetch "https://dl.k8s.io/release/$kubectl_version/bin/linux/amd64/kubectl" kubectl "$kubectl_sha256"
chmod +x kind helm kubectl
rm helm.tar.gz

echo "$bin" >> "$GITHUB_PATH"
"$bin/kind" version
"$bin/helm" version --short
"$bin/kubectl" version --client
