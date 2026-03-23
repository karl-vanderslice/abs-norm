# syntax=docker/dockerfile:1
# Nix-based image build for docker-compose compatibility.
FROM nixos/nix:2.24.14

WORKDIR /work
COPY . .

# Install the flake app into the image profile.
RUN nix profile install --accept-flake-config --extra-experimental-features 'nix-command flakes' path:/work#abs-norm

ENV PORT=8042
ENV PUBLIC_BASE_URL=http://localhost:8042
EXPOSE 8042

CMD ["abs-norm"]
