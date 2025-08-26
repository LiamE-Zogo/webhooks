# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Start development server**: `deno run --watch main.ts` or `deno task dev`
- **Run tests**: `deno test` (tests use Deno's built-in test runner with @std/assert)
- **Run main application**: `deno run main.ts`

## Project Architecture

ZAPI-2.0 is a Deno-based REST API using Oak framework. This is the next generation of the Zogo API, designed to eventually replace the existing backend with new features developed here.

### Key Architecture Components

- **Entry Point**: `src/main.ts` - Creates Oak Application instance and starts server on port from `API_PORT` env var (defaults to 8000)
- **Routing**: `src/api/routes/index.ts` - Contains API route definitions using Oak Router
- **Project Structure**:
  - `src/api/routes/` - API route handlers and definitions
  - `src/db/` - Database-related code (currently empty)
  - `src/helpers/` - Utility functions and helpers (currently empty)

### Framework and Dependencies

- **Runtime**: Deno (using JSR imports)
- **Web Framework**: Oak (`jsr:@oak/oak`) - Middleware framework for HTTP servers
- **Testing**: Deno standard library assertions (`jsr:@std/assert@1`)

### Environment Variables

- `API_PORT` - Server port (defaults to 8000)

## Development Notes

- The project uses Deno's native module system with JSR (JavaScript Registry) imports
- No package.json - dependencies managed through deno.json imports map
- Tests should be placed alongside source files with `_test.ts` suffix
- Current API has a basic `/status` endpoint returning "Hello World"