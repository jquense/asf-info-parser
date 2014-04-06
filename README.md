ASF (WMA) Audio Metadata parser
=====================================

A simple streaming parser for retrieving ASF metadata from an wma/asf file

### Install

    npm install asf-parser

### Use
The parser is simply a stream in objectMode, so you can pipe and binary data into it and it will spit out tag objects.

    var asf = require('asf-parser')
      , stream = require('fs').createReadStream('./my-audio.wma')

    var parser = stream.pipe(new asf());

    parser.on('data', function(tag){
        console.log(tag.type)  // => 'WM/Artist'
        console.log(tag.value) // => 'Bastille'
    })

