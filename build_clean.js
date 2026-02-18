#!/usr/bin/env node

/**
 * Removes all build artifacts from app/assets/builds/, preserving .keep.
 * Use this to clear stale build artifacts or to get a clean build from scratch.
 *
 * Run via: yarn build:clean
 * Or before a full build: yarn build (which runs build:clean first)
 */

const fs = require('fs');
const path = require('path');

const BUILDS_DIR = path.join(__dirname, 'app', 'assets', 'builds');
const KEEP_FILE = '.keep';

function cleanBuilds() {
  if (!fs.existsSync(BUILDS_DIR)) {
    console.log('Builds directory does not exist, nothing to clean.');
    return;
  }

  const entries = fs.readdirSync(BUILDS_DIR, { withFileTypes: true });
  let removedCount = 0;

  for (const entry of entries) {
    if (entry.name === KEEP_FILE) {
      continue;
    }
    const fullPath = path.join(BUILDS_DIR, entry.name);
    try {
      if (entry.isDirectory()) {
        fs.rmSync(fullPath, { recursive: true });
      } else {
        fs.unlinkSync(fullPath);
      }
      removedCount++;
      console.log(`Removed: ${entry.name}`);
    } catch (err) {
      console.warn(`Warning: Could not remove ${entry.name}:`, err.message);
    }
  }

  if (removedCount > 0) {
    console.log(`Cleaned ${removedCount} artifact(s) from app/assets/builds/`);
  } else {
    console.log('Builds directory already clean.');
  }
}

cleanBuilds();
