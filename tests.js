"use strict"

const assert  = require("assert")
const gulp    = require("gulp")
const fs      = require("fs-extra")
const glupost = require(".")


// TODO
// - add template tests
// - add "Transforms must return/resolve with a file, a buffer or a string." error test

let state


const tests = {

   "function (sync)": {
      task: function(){
         state = true
      },
      test: function(){
         return state === true
      }
   },

   "function (async callback)": {
      task: function(done){
         state = true
         done()
      },
      test: function(){
         return state === true
      }
   },

   "function (async promise)": {
      task: function(){
         state = true
         return Promise.resolve()
      },
      test: function(){
         return state === true
      }
   },

   "alias": {
      task: "function (sync)",
      test: function(){
         return state === true
      }
   },

   "aliased alias": {
      task: "alias",
      test: function(){
         return state === true
      }
   },

   "object (rename)": {
      task: {
         src: "birds/owls.txt",
         rename: "birds/owls-do.txt"
      },
      test: function(){
         return read("birds/owls.txt") === read("birds/owls-do.txt")
      }
   },
   "object (dest)": {
      task: {
         src: "birds/owls.txt",
         dest: "birds/prey/"
      },
      test: function(){
         return read("birds/owls.txt") === read("birds/prey/owls.txt")
      }
   },

   "object (base)": {
      task: {
         src: "birds/owls.txt",
         base: "",
         dest: "birds/prey/"
      },
      test: function(){
         return read("birds/owls.txt") === read("birds/prey/owls.txt")
      }
   },

   "object (transform-string)": {
      task: {
         src: "birds/owls.txt",
         dest: "birds/",         
         transforms: [(contents, file) => "maybe"]
      },
      test: function(){
         return read("birds/owls.txt") === "maybe"
      }
   },

   "object (transform-buffer)": {
      task: {
         src: "birds/owls.txt",
         dest: "birds/",
         transforms: [(contents, file) => Buffer.from("maybe")]
      },
      test: function(){
         return read("birds/owls.txt") === "maybe"
      }
   },

   "object (transform-vinyl)": {
      task: {
         src: "birds/owls.txt",
         dest: "birds/",
         transforms: [(contents, file) => { file.contents = Buffer.from("maybe"); return file }]
      },
      test: function(){
         return read("birds/owls.txt") === "maybe"
      }
   },

   "object (transform-promise)": {
      task: {
         src: "birds/owls.txt",
         dest: "birds/",
         transforms: [(contents, file) => Promise.resolve("maybe")]
      },
      test: function(){
         return read("birds/owls.txt") === "maybe"
      }
   },

   "object (transform-chain)": {
      task: {
         src: "birds/owls.txt",
         dest: "birds/",
         transforms: [
            (contents, file) => contents + "\n- yes",
            (contents, file) => Buffer.concat([contents, Buffer.from("\n- no")]),
            (contents, file) => { file.contents = Buffer.concat([file.contents, Buffer.from("\n- maybe")]); return file }
         ]
      },
      test: function(){
         return read("birds/owls.txt") === "Do owls exist?\n- yes\n- no\n- maybe"
      }
   },

   "object (series)": {
      task: {
         series: [
            (done) => setTimeout( () => { state.first = time(); done() }, 100 ),
            () => state.second = time()
         ]
      },
      test: function(){
         return state.first < state.second
      }
   },

   "object (parallel)": {
      task: {
         parallel: [
            (done) => setTimeout( () => { state.first = time(); done() }, 100 ),
            () => state.second = time()
         ]
      },
      test: function(){
         return state.first > state.second
      }
   }

}

const watchers = {

   "watch (true)": {
      task: {
         src: "birds/owls.txt",
         dest: "birds",
         watch: true,
         series: [() => { state = true }]
      },
      triggers: [() => write("birds/owls.txt", "no")],
      test: function(){
         return state === true
      }
   },

   "watch (path)": {
      task: {
         watch: "birds/owls.txt",
         series: [() => { state = true }]
      },
      triggers: [() => write("birds/owls.txt", "no")],
      test: function(){
         return state === true
      }
   },

   "watch (multiple changes)": {
      task: {
         watch: "birds/owls.txt",
         series: [() => { state = (typeof state === "number") ? state + 1 : 1 }]
      },
      triggers: [() => write("birds/owls.txt", "yes"), () => write("birds/owls.txt", "no"), () => write("birds/owls.txt", "maybe")],
      test: function(){
         return state === 3
      }
   }

}

const invalids = {

   "nonexistent task": {
      error: 'Task "ghost" does not exist.',
      tasks: {
         "alias": "ghost"
      }
   },

   "circular aliases": {
      error: "Circular aliases.",
      tasks: {
         "alias": "ghost",
         "ghost": "alias"
      }
   },

   "task type": {
      error: "A task must be a string, function, or object.",
      tasks: {
         "task": true
      }
   },

   "noop task": {
      error: "A task must do something.",
      tasks: {
         "task": {}
      }
   },

   "watch without src": {
      error: "No path given to watch.",
      tasks: {
         "task": {
            watch: true
         }
      }
   },

   "series and parallel": {
      error: "A task can't have both .series and .parallel properties.",
      tasks: {
         "task": {
            series: [], parallel: []
         }
      }
   }

}



// Prepare test files and cleanup routine.

function prepare(){

   beforeEach(function(){
      write("birds/owls.txt", "Do owls exist?")
      state = {}
   })

   after(cleanup)
   process.on("exit", cleanup)
   process.on("SIGINT", cleanup)

}

// Destroy test files.

function cleanup(){

   fs.removeSync("./birds")

}



describe("tasks", function(){

   prepare()

   // Create tasks.
   const names = Object.keys(tests)
   const tasks = names.reduce(function( result, name ){
      result[name] = tests[name].task
      return result
   }, {})

   glupost({ tasks })


   // Run tests.
   for( const name of names ){
      const { test } = tests[name]
      it(name, function(done){
         gulp.series(
            name, 
            () => {
               try{
                  assert.ok(test())
                  done()
               }
               catch(e){
                  done(e)
               }
            }
         )()
      })
   }

})

describe("watch tasks", function(){

   prepare()

   // Create tasks.
   const names = Object.keys(watchers)
   const tasks = names.reduce(function( result, name ){
      result[name] = watchers[name].task
      return result
   }, {})

   glupost({ tasks })


   // Run tests.
   for( const name of names ){
      const { task, triggers, test } = watchers[name]
      it(name, function( done ){
         const watcher = gulp.watch(task.watch, { delay: 0 }, gulp.task(name))
         watcher.on("ready", triggers.shift())
         watcher.on("change", () => {

            // Gulp watch uses a `setTimeout` with the previously defined `delay` (0), meaning we have to wait 
            // awhile (10ms seems to work) for the task to start.
            setTimeout(() => {

               // Not the last trigger - call the next one in 100ms. I couldn't find the `chokidar` option that 
               // regulates the interval needed to pass for the next change to register successfully. Either way, 
               // this sort of delay simulates real world edits, which is ok I guess.
               if( triggers.length ){
                  setTimeout(triggers.shift(), 100)
                  return
               }

               try{
                  assert.ok(test())
                  done()
               }
               catch(e){
                  done(e)
               }
               watcher.close()

            }, 10)

         })

      })
   }

})

describe("errors", function(){

   const names = Object.keys(invalids)
   for( const name of names ){
      const config = invalids[name]
      it(name, () => assert.throws(() => glupost(config), e => (e instanceof Error && e.message === config.error)))
   }

})



function time(){
   
   const [s, ns] = process.hrtime()
   return s * 1000000 + ns / 1000

}

function read( path ){

   return fs.readFileSync(path, "utf8")

}

function write( path, content ){

   if( content )
      fs.outputFileSync(path, content)
   else
      fs.ensureDirSync(path)

}