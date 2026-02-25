# Service Error Classes

Each service defines custom error classes for business logic failures.

## Standard Error Classes

Every service should define these three error classes:

```typescript
/**
 * Validation error - invalid input data
 */
export class ServiceValidationError extends Error {
  constructor(
    message: string,
    public field?: string // Optional: which field failed
  ) {
    super(message);
    this.name = 'ServiceValidationError';
  }
}

/**
 * Permission error - user not authorized
 */
export class ServicePermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServicePermissionError';
  }
}

/**
 * Not found error - resource doesn't exist
 */
export class ServiceNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServiceNotFoundError';
  }
}
```

**Replace "Service" with actual service name** (e.g., `ProjectValidationError`).

## When to Use Each

| Error                   | HTTP Status | Use When                                    |
| ----------------------- | ----------- | ------------------------------------------- |
| `ValidationError`       | 400         | Input data fails business rules             |
| `PermissionError`       | 403         | User lacks permission for operation         |
| `NotFoundError`         | 404         | Resource doesn't exist                      |
| Generic `Error`         | 500         | Unexpected failures, database errors        |

## Service Example

```typescript
// lib/services/ProjectService.ts

export class ProjectValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ProjectValidationError';
  }
}

export class ProjectPermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectPermissionError';
  }
}

export class ProjectNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectNotFoundError';
  }
}

export class ProjectService {
  async createProject(userId: string, data: CreateProjectRequest) {
    // Validation
    if (data.completionPercentage < 50) {
      throw new ProjectValidationError(
        'Completion must be 50-95%',
        'completionPercentage'
      );
    }

    // Permission check
    const user = await this.userRepo.findById(userId);
    if (!user?.isSeller) {
      throw new ProjectPermissionError('Only sellers can create projects');
    }

    // Not found check
    const existing = await this.projectRepo.findById(projectId);
    if (!existing) {
      throw new ProjectNotFoundError('Project not found');
    }

    // ... business logic
  }
}
```

## API Route Handling

```typescript
// app/api/projects/route.ts

try {
  const project = await projectService.createProject(userId, data);
  return NextResponse.json(project, { status: 201 });
} catch (error) {
  if (error instanceof ProjectValidationError) {
    return NextResponse.json(
      { error: 'Validation error', message: error.message, field: error.field },
      { status: 400 }
    );
  }

  if (error instanceof ProjectPermissionError) {
    return NextResponse.json(
      { error: 'Forbidden', message: error.message },
      { status: 403 }
    );
  }

  if (error instanceof ProjectNotFoundError) {
    return NextResponse.json(
      { error: 'Not found', message: error.message },
      { status: 404 }
    );
  }

  // Generic error fallback
  return NextResponse.json(
    { error: 'Internal error', message: error.message },
    { status: 500 }
  );
}
```

## Key Principles

1. **One service = one set of error classes** (ProjectService → Project*Error)
2. **Always include the service name prefix** for clarity
3. **ValidationError can have optional `field` property** to identify which field failed
4. **Set `this.name`** to match the class name for better debugging
5. **Throw early** - validate at the start of service methods

## Anti-Patterns

❌ **Don't reuse generic Error:**
```typescript
throw new Error('Invalid input'); // Lost context
```

✅ **Use typed errors:**
```typescript
throw new ProjectValidationError('Invalid input', 'title');
```

❌ **Don't create one error class per method:**
```typescript
export class CreateProjectError extends Error {}
export class UpdateProjectError extends Error {}
```

✅ **Use semantic categories:**
```typescript
export class ProjectValidationError extends Error {}
export class ProjectPermissionError extends Error {}
export class ProjectNotFoundError extends Error {}
```
