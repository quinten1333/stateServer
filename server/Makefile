imageName=ghcr.io/quinten1333/stateserver:latest

.phony: build push run runDebug

build:
	docker build -t ${imageName} .

push:
	docker push ${imageName}

run:
	docker run --rm -p 3001:80 -p 3002:2000 -it --name="stateServer" -v /var/run/dbus:/var/run/dbus ${imageName}

runDebug:
	docker run --rm -p 3001:80 -p 3002:2000 -it --name="stateServer" -v /var/run/dbus:/var/run/dbus --entrypoint=/bin/sh ${imageName}
