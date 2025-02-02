#!/usr/bin/env node

'use strict';
const nodeCleanup = require('node-cleanup');
const spawn = require('cross-spawn');
const run = require('./runner');
const { extractArgs } = require('./args-manager');
const { manipulate, detectState, isClear, print } = require('./stdout-manipulator');

let firstTime = true;
let firstSuccessKiller = null;
let successKiller = null;
let failureKiller = null;

const {
  onFirstSuccessCommand,
  onSuccessCommand,
  onFailureCommand,
  noColors,
  noClear,
  compiler,
  args,
} = extractArgs(process.argv);

function killProcesses(killAll) {
  return Promise.all([
    killAll && firstSuccessKiller ? firstSuccessKiller() : null,
    successKiller ? successKiller() : null,
    failureKiller ? failureKiller() : null,
  ]);
}

let bin;
try {
  bin = require.resolve(compiler);
} catch (e) {
  if (e.code === 'MODULE_NOT_FOUND') {
    console.error(e.message);
    process.exit(9);
  }
  throw e;
}

const tscProcess = spawn(bin, [...args]);
tscProcess.stdout.on('data', buffer => {
  if (noClear && isClear(buffer)) {
    return;
  }

  const bufferString = buffer
    .toString()
    .split('\n')
    .filter(a => a.includes('.ts'));



  const lines = manipulate(buffer);
  print(noColors, noClear, lines);
  const state = detectState(lines);
  const compilationError = state.compilationError;
  const compilationComplete = state.compilationComplete;

  if (compilationComplete) {
    killProcesses(false).then(() => {
      if (compilationError) {
        Signal.emitFail(bufferString);
        if (onFailureCommand) {
          failureKiller = run(onFailureCommand);
        }
      } else {
        Signal.emitSuccess();
        if (firstTime && onFirstSuccessCommand) {
          firstTime = false;
          firstSuccessKiller = run(onFirstSuccessCommand);
        } else if (onSuccessCommand) {
          successKiller = run(onSuccessCommand);
        }
      }
    });
  }
});

const Signal = {
  send: typeof process.send === 'function' ? (...e) => process.send(...e) : () => {},
  _successStr: 'first_success',
  emitSuccess: () => {
    Signal.send({event:Signal._successStr});
    Signal._successStr = 'subsequent_success';
  },

  emitFail: (lines) => Signal.send({event:'compile_errors', lines:lines}),
};

nodeCleanup((_exitCode, signal) => {
  tscProcess.kill(signal);
  killProcesses(true).then(() => process.exit());
  // don't call cleanup handler again
  nodeCleanup.uninstall();
  return false;
});
