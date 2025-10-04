#!/usr/bin/env ts-node

/**
 * Build script for Lambda functions
 * Compiles TypeScript and copies necessary files for deployment
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const LAMBDA_DIRS = [
  'src/lambda/transaction-processor',
  'src/lambda/weekly-insights-generator',
  'src/lambda/api-handler'
];

const ROOT_DIR = process.cwd();

async function buildLambda(lambdaDir: string) {
  console.log(`Building Lambda function: ${lambdaDir}`);
  
  const fullPath = path.join(ROOT_DIR, lambdaDir);
  
  // Check if directory exists
  if (!fs.existsSync(fullPath)) {
    console.error(`Lambda directory not found: ${fullPath}`);
    return false;
  }

  try {
    // Copy shared dependencies to Lambda directory
    const sharedDirs = ['src/database', 'src/types', 'src/utils'];
    
    for (const sharedDir of sharedDirs) {
      const srcPath = path.join(ROOT_DIR, sharedDir);
      const destPath = path.join(fullPath, sharedDir.replace('src/', ''));
      
      if (fs.existsSync(srcPath)) {
        // Create destination directory
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        
        // Copy files recursively
        execSync(`cp -r "${srcPath}" "${path.dirname(destPath)}"`, { cwd: ROOT_DIR });
        console.log(`  Copied ${sharedDir} to ${destPath}`);
      }
    }

    // Copy root package.json dependencies info
    const rootPackageJson = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));
    const lambdaPackageJsonPath = path.join(fullPath, 'package.json');
    
    if (fs.existsSync(lambdaPackageJsonPath)) {
      const lambdaPackageJson = JSON.parse(fs.readFileSync(lambdaPackageJsonPath, 'utf8'));
      
      // Merge dependencies from root package.json
      lambdaPackageJson.dependencies = {
        ...lambdaPackageJson.dependencies,
        ...rootPackageJson.dependencies
      };
      
      fs.writeFileSync(lambdaPackageJsonPath, JSON.stringify(lambdaPackageJson, null, 2));
      console.log(`  Updated package.json with shared dependencies`);
    }

    // Create tsconfig.json for Lambda compilation
    const tsconfigPath = path.join(fullPath, 'tsconfig.json');
    const tsconfig = {
      "compilerOptions": {
        "target": "ES2020",
        "module": "commonjs",
        "lib": ["ES2020"],
        "outDir": "./dist",
        "rootDir": "./",
        "strict": true,
        "esModuleInterop": true,
        "skipLibCheck": true,
        "forceConsistentCasingInFileNames": true,
        "resolveJsonModule": true,
        "declaration": false,
        "sourceMap": false
      },
      "include": ["**/*.ts"],
      "exclude": ["node_modules", "dist"]
    };
    
    fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2));
    console.log(`  Created tsconfig.json`);

    // Install dependencies (including dev dependencies for compilation)
    console.log(`  Installing dependencies...`);
    execSync('npm install', { cwd: fullPath, stdio: 'inherit' });

    // Compile TypeScript to JavaScript
    console.log(`  Compiling TypeScript...`);
    execSync('npx tsc', { cwd: fullPath, stdio: 'inherit' });

    // Copy compiled JS files to root of Lambda directory
    const distPath = path.join(fullPath, 'dist');
    if (fs.existsSync(distPath)) {
      execSync(`cp -r ${distPath}/* .`, { cwd: fullPath });
      console.log(`  Copied compiled files to Lambda root`);
    }

    // Clean up dev dependencies for production
    console.log(`  Cleaning up dev dependencies...`);
    execSync('npm prune --production', { cwd: fullPath, stdio: 'inherit' });

    console.log(`✅ Successfully built ${lambdaDir}`);
    return true;
    
  } catch (error) {
    console.error(`❌ Failed to build ${lambdaDir}:`, error);
    return false;
  }
}

async function main() {
  console.log('Building Lambda functions...\n');
  
  let allSuccessful = true;
  
  for (const lambdaDir of LAMBDA_DIRS) {
    const success = await buildLambda(lambdaDir);
    allSuccessful = allSuccessful && success;
    console.log('');
  }
  
  if (allSuccessful) {
    console.log('🎉 All Lambda functions built successfully!');
    process.exit(0);
  } else {
    console.log('💥 Some Lambda functions failed to build');
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}