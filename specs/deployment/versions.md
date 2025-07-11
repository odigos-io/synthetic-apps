# Versions Deployment

This type of deployment is mean to test the application with various relevant runtime versions, and ensure that the application is compatible with the different versions.

## Requirements

- The application runtime version SHOULD NOT be discoverable in runtime detection mechanisms, so to test we are not crashing any version, even if it ends up running by any means. Where it's required (php and ruby), the version should be set accordingly.

## Deployment Types

### HTTPServer

Mainstream runtime version that is most likely to be used in current applications. If you don't care to check something specific in a version, this is the one to use by default.

### Version Latest

The latest version of the runtime that is supported by odigos. This helps us ensure that we work with the bleeding edge of the runtime out there without any breaking issues.

### Version Minimum

The minimum version of the runtime that odigos supports. If there are any features we are using that are not available in the minimum version, this is the one to catch that.

### Version Unsupported

The latest version of the runtime that odigos does not support. This helps us ensure that we are not using any features that are not available in the latest version of the runtime.

### Version Very Old

A very old version of the runtime that has long been deprecated. This helps us ensure that if odigos encounters a very old version of the runtime, it will not crash.
