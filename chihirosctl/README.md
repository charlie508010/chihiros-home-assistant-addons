# Chihiros CTL

Runs `chihirosctl` inside a Home Assistant add-on container.

The add-on fetches the source from the main Chihiros repository and can copy the Home Assistant integration into `/config/custom_components/chihiros`.

After the first install or update, restart Home Assistant.

Example command inside the add-on container:

```bash
chihirosctl doser show-schedules doser_1
```
