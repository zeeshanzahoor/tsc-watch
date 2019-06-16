const TscWatchClient = require('./lib/client');
const watch = new TscWatchClient();
watch.on('first_success', () => {
    console.log('First success!');
  });
   
  watch.on('subsequent_success', () => {
    console.log('subsequent_success!');
    });
   
  watch.on('compile_errors', (lines) => {
    console.log('----------------errors-started-------------');
    console.log(lines);
    console.log('----------------errors-finished-------------');
 });
   
  watch.start('--project', './example');