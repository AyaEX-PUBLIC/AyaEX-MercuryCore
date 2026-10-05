# use the official Bun image
# see all versions at https://hub.docker.com/r/oven/bun/tags
FROM oven/bun AS base
WORKDIR /app

# install dependencies into temp directory
# this will cache them and speed up future builds
FROM base AS install

# install with --production (exclude devDependencies)
RUN mkdir -p /temp/prod
# upstream bun.lock is behind package.json, and --production implies a frozen
# lockfile in Bun, so resolve from package.json alone. vite.config.ts imports a
# devDependency, so install those as well.
COPY Site/package.json /temp/prod/
RUN cd /temp/prod && bun i

# copy production dependencies and source code into final image
FROM base AS release
COPY --from=install /temp/prod/node_modules node_modules
COPY Assets Assets
COPY Site Site
COPY mercury.core.ts mercury.core.ts

# build the app
WORKDIR /app/Site
RUN bun run build

# # run the app
ENTRYPOINT ["bun", "-b", "./build"]
