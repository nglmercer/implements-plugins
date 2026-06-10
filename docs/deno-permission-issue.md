# Feature Request: Dynamic Permission Requests for Plugin Systems

## Summary

Add support for runtime permission requests via `Deno.permissions.request()` API, enabling plugin systems to request permissions dynamically during execution rather than requiring all permissions at startup.

## Motivation

Plugin systems need to:
1. Load plugins that may require different permissions
2. Request permissions only when actually needed (lazy loading)
3. Provide better user experience by requesting permissions contextually
4. Support plugins from untrusted sources with granular permission control

## Current Limitations

```typescript
// Current: All permissions must be specified at startup
deno run --allow-read --allow-net app.ts

// Problem: Plugin loaded later may need write permissions
// but we can't request them dynamically
const plugin = await loadPlugin("./my-plugin.ts");
plugin.setup(); // May need --allow-write, but we can't request it
```

## Proposed API

### Option 1: Direct Permission Request

```typescript
const permission = await Deno.permissions.request({
  name: "write",
  path: "/safe/path/",
});

if (permission.state === "granted") {
  // Proceed with file write
  await Deno.writeTextFile("/safe/path/file.txt", content);
}
```

### Option 2: Plugin Permission Context

```typescript
interface PluginPermissionContext {
  request(perm: Deno.PermissionDescriptor): Promise<Deno.PermissionStatus>;
  check(perm: Deno.PermissionDescriptor): Promise<Deno.PermissionStatus>;
  revoke(perm: Deno.PermissionDescriptor): Promise<Deno.PermissionStatus>;
}

// Usage in plugin
class MyPlugin implements IPlugin {
  constructor(private perms: PluginPermissionContext) {}
  
  async setup() {
    const status = await this.perms.request({ name: "net" });
    if (status.state === "granted") {
      // Make network requests
    }
  }
}
```

### Option 3: Permission Middleware

```typescript
const manager = new PluginManager({
  permissions: {
    // Pre-declare required permissions
    required: ["read", "net"],
    // Optional permissions that can be requested at runtime
    optional: ["write", "env"],
    // Custom handler for permission requests
    onRequest: async (plugin, permission) => {
      // Log, prompt user, apply policy, etc.
      return await Deno.permissions.request(permission);
    },
  },
});
```

## Use Cases

### 1. Lazy Permission Loading
```typescript
// Plugin only requests network permission when feature is used
class ApiPlugin {
  async fetchData() {
    const perm = await Deno.permissions.request({ name: "net" });
    if (perm.state !== "granted") {
      throw new Error("Network permission required");
    }
    return await fetch("https://api.example.com");
  }
}
```

### 2. Granular File Access
```typescript
// Plugin requests specific directory access
class StoragePlugin {
  constructor(private basePath: string) {}
  
  async init() {
    await Deno.permissions.request({
      name: "read",
      path: this.basePath,
    });
    await Deno.permissions.request({
      name: "write", 
      path: this.basePath,
    });
  }
}
```

### 3. Conditional Features
```typescript
// Plugin enables features based on available permissions
class EnhancedPlugin {
  async setup() {
    const envPerm = await Deno.permissions.query({ name: "env" });
    if (envPerm.state === "granted") {
      this.enableEnvFeatures();
    }
    
    const netPerm = await Deno.permissions.query({ name: "net" });
    if (netPerm.state === "granted") {
      this.enableOnlineFeatures();
    }
  }
}
```

## Security Considerations

1. **User Consent**: `request()` should prompt user (similar to browser permissions)
2. **Scope Limitation**: Permissions should be scoped to specific paths/domains
3. **Audit Trail**: Log permission requests for security review
4. **Revocation**: Support `Deno.permissions.revoke()` for cleanup
5. **Timeout**: Permission prompts should have configurable timeouts

## Implementation Notes

- `Deno.permissions.query()` already exists for checking current state
- `Deno.permissions.request()` would add the prompting mechanism
- Consider `Deno.permissions.revoke()` for cleanup
- Should integrate with existing `--allow-*` flags (not replace them)

## Related Work

- Deno's existing permission system (`Deno.permissions.query()`)
- Browser Permissions API
- Node.js `process.permission` proposal

## Alternatives Considered

1. **Environment Variables**: Use env vars to pass permission config (less secure)
2. **Config Files**: Load permissions from JSON config (static, not dynamic)
3. **Sandboxing**: Run plugins in separate isolates (performance overhead)

## Questions for Discussion

1. Should `request()` block until user responds, or return immediately?
2. How to handle permission fatigue (too many prompts)?
3. Should plugins be able to declare permissions in metadata for pre-checking?
4. Integration with Deno's permission policy system?

---

**Labels**: `permissions`, `plugin-system`, `enhancement`
