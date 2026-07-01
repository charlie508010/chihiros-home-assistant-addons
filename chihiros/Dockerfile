ARG BUILD_ARCH
FROM ghcr.io/home-assistant/${BUILD_ARCH}-base:latest

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

RUN apk add --no-cache \
    bash \
    bluez \
    dbus \
    git \
    py3-pip \
    python3 \
    py3-virtualenv \
  && python3 -m venv /opt/chihiros-venv \
  && /opt/chihiros-venv/bin/pip install --no-cache-dir --upgrade pip \
  && /opt/chihiros-venv/bin/pip install --no-cache-dir \
    bleak-retry-connector==4.6.1 \
    bleak \
    rich \
    "typer[all]==0.15.2"

COPY run.sh /run.sh
COPY ui /opt/chihiros-addon-ui

RUN chmod a+x /run.sh \
  && printf '%s\n' '#!/usr/bin/env bash' 'export PYTHONPATH=/opt/chihiros-src:${PYTHONPATH}' 'exec /opt/chihiros-venv/bin/python -m custom_components.chihiros.chihiros_led_control.chihirosctl "$@"' > /usr/bin/chihirosctl \
  && chmod a+x /usr/bin/chihirosctl

ENV PYTHONPATH=/opt/chihiros-src
CMD ["/run.sh"]
