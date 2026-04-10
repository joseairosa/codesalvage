# API Response Format

All API routes use NextResponse.json with consistent structure.

## Success Response

```typescript
return NextResponse.json(data, { status: 200 });
// or 201 for created resources
return NextResponse.json(newResource, { status: 201 });
```

## Error Response

Always include `error` field. Optional: `message`, `details`, `field`.

```typescript
// Simple error
return NextResponse.json(
  { error: 'Unauthorized' },
  { status: 401 }
);

// With message
return NextResponse.json(
  {
    error: 'Validation error',
    message: error.message,
  },
  { status: 400 }
);

// With Zod validation details
return NextResponse.json(
  {
    error: 'Invalid request',
    details: validatedData.error.errors,
  },
  { status: 400 }
);

// With field reference
return NextResponse.json(
  {
    error: 'Validation error',
    message: error.message,
    field: error.field, // from ProjectValidationError
  },
  { status: 400 }
);
```

## Status Codes

| Code | Use                              |
| ---- | -------------------------------- |
| 200  | Success (GET, PUT, DELETE)       |
| 201  | Created (POST)                   |
| 400  | Bad request (validation)         |
| 401  | Unauthorized (not authenticated) |
| 403  | Forbidden (not authorized)       |
| 404  | Not found                        |
| 500  | Internal server error            |

## Error Handling Pattern

```typescript
try {
  // Auth check
  const auth = await authenticateApiRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Validation
  const validatedData = schema.safeParse(body);
  if (!validatedData.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validatedData.error.errors },
      { status: 400 }
    );
  }

  // Business logic
  const result = await service.doSomething(validatedData.data);

  return NextResponse.json(result, { status: 200 });
} catch (error) {
  // Service-specific errors
  if (error instanceof ProjectValidationError) {
    return NextResponse.json(
      { error: 'Validation error', message: error.message, field: error.field },
      { status: 400 }
    );
  }

  // Generic errors
  if (error instanceof Error) {
    return NextResponse.json(
      { error: 'Operation failed', message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
```

## Anti-Patterns

❌ **Don't return raw data:**
```typescript
return NextResponse.json(data); // Missing status
```

✅ **Always include status:**
```typescript
return NextResponse.json(data, { status: 200 });
```

❌ **Don't use generic error messages:**
```typescript
return NextResponse.json({ error: 'Error' }, { status: 500 });
```

✅ **Be specific:**
```typescript
return NextResponse.json(
  { error: 'Failed to create project', message: error.message },
  { status: 500 }
);
```
