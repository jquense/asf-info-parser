///http://msdn.microsoft.com/en-us/library/bb643323.aspx 10.2 for asf guids the super non intuitive guid to hex is below
'use strict';
var inherits = require('util').inherits
  , binary = require('./binaryHelpers')
  , Tokenizr = require('stream-tokenizr')
  , _ = require('lodash');

var enc = 'utf16'
  , magicWord =       toBuffer('75B22630-668E-11CF-A6D9-00AA0062CE6C')
  , guids = {
          fileProp:   toBuffer('8CABDCA1-A947-11CF-8EE4-00C00C205365')
        , content:    toBuffer('75B22633-668E-11CF-A6D9-00AA0062CE6C')
        , xcontent:   toBuffer('D2D0A440-E307-11D2-97F0-00A0C95EA850')
        , metaData:   toBuffer('C5F8CBEA-5BAF-4877-8467-AA8C44FA4CCA')
        , library:    toBuffer('44231C94-9498-49D1-A141-1D134E457054')
        , dataObject: toBuffer('75B22636-668E-11CF-A6D9-00AA0062CE6C') //first non header
    }


var getStr = _.partialRight(binary.decodeString, enc)
  , valueParser = [
        getStr,
        parsePicture,
        function(b){ return b.readUInt32LE(0) === 1},
        function(b){ return b.readUInt32LE(0) },
        function(b){ return b.readUInt32LE(0) }, //64int
        function(b){ return b.readUInt16LE(0) },

        getStr,
        function(){},
        function(b){ return b.readUInt16LE(0) === 1},
        function(b){ return b.readUInt32LE(0) },
        function(b){ return b.readUInt32LE(0) },
        function(b){ return b.readInt8(0) },
        toGuid
    ]

inherits(AsfParser, Tokenizr)

module.exports = AsfParser

function AsfParser(){
    var self = this;

    if ( !(self instanceof AsfParser) ) 
        return new AsfParser()

    Tokenizr.call(this, { objectMode: true })

    this.tags = {}

    self._headersleft = 5; //short circuit

    this.isEqual(magicWord, 'not an asf file')
        .skip(14)
        .loop(function( end){

            this.skipUntil( 16, self.isHeaderGuid, self )
                .skip(24)
                .tap(self.parseHeader)
                .tap(function(){
                    self._headersleft <= 0 && end()
                })
        })
        .tap(function(){
            self.push(null)  
        })
}

AsfParser.toBuffer = toBuffer
AsfParser.toGuid = toGuid
AsfParser.parsePicture = parsePicture

AsfParser.prototype.parseHeader = function(){
    switch (this._current) {
        case 'fileProp':
            this._props()
            break;
        case 'content':
            this._content()
            break;
        case 'metaData':
        case 'library':
            this.parseAttributes()
            break;
        case 'xcontent':
            this.parseDescriptors()
            break;
        case 'dataObject':
            return this._headersleft = 0
    }
    this._headersleft--
}

AsfParser.prototype._content = function(){

    this.readUInt16LE('title_len')
        .readUInt16LE('author_len')
        .readUInt16LE('copyright_len')
        .readUInt16LE('desc_len')
        .readUInt16LE('rating_len')
        .readString('title_len',     enc, 'title')
        .readString('author_len',    enc, 'author')
        .readString('copyright_len', enc, 'copyright')
        .readString('desc_len',      enc, 'desc')
        .readString('rating_len',    enc, 'rating')
        .tap(function(tok){
            var self = this;

            _.each(['title', 'author', 'copyright', 'desc', 'rating'], function(i){
                if ( tok[i] != null ) self.pushToken(i, clean(tok[i]))
            })
        })
        .flush()
}

AsfParser.prototype._props = function(chain){
    this.skip(40)
        .readUInt32LE('length')
        .skip(12)               //stream duration and last 4 bytes of length
        .readUInt32LE('preroll')
        .tap(function(tok){
            var dur = tok.length / 10000000 - tok.preroll / 1000 //ref taglib again for this one

            this.pushToken('duration', dur ) 
        })
        .flush();
}

AsfParser.prototype.parseDescriptors = function(){
    this.readUInt16LE('tag_count')
        .loop(function(end){
            this.readUInt16LE('name_len')
                .readString('name_len', enc, 'name')
                .readUInt16LE('val_dataType')
                .readUInt16LE('val_len')
                .readBuffer('val_len', 'value')
                .tap(function(tok){
                    if ( tok.name && tok.value ) 
                        this.pushToken(tok.name, clean(valueParser[tok.val_dataType](tok.value)) )

                    if ( --tok.tag_count === 0) end()
                })
        })
        .flush()
}

AsfParser.prototype.parseAttributes = function(){
    this.readUInt16LE('tag_count')
        .loop(function(end){
            this.skip(4)
                .readUInt16LE('name_len')
                .readUInt16LE('val_dataType')
                .readUInt32LE('val_len')
                .readString('name_len', enc, 'name')
                .readBuffer('val_len', 'value')
                .tap(function(tok){
                    if ( tok.name && tok.value )
                        this.pushToken(tok.name, clean(valueParser[tok.val_dataType + 5](tok.value)) )
                    if ( --tok.tag_count === 0) end()
                })
        })
        .flush()
}

AsfParser.prototype.pushToken = function(key, value){
    this.push({ 
        type: clean(key), 
        value: value 
    });
}

AsfParser.prototype.isHeaderGuid = function(hdr){
    var self = this;

    return _.any(guids, function(b, key){
        if( binary.bufferEqual(hdr, b)) 
            return self._current = key 
          
        return false;
    });
}


function parsePicture(buf){
    var delim = getDelim(enc)
      , off = 5
      , zero = binary.indexOf(buf, delim, off, true )
      , tag = {};

    if (zero === -1) return {}

    tag.mime = binary.decodeString(buf, 'utf16', off, zero)

    off = zero + delim.length;
    
    tag.type = PIC_TYPES[buf[0]] //TODO check if this holds for every case?

    zero = binary.indexOf(buf, delim, off, true)

    if (zero < off) return {};

    tag.desc = binary.decodeString(buf, enc, off, off = zero )
    tag.data = buf.slice(off + delim.length)
    return tag
}

function getDelim(enc){
    return enc === 'utf16'
        ? new Buffer([0x00, 0x00])
        : new Buffer([0x00]);    
}

function clean(str){
    if ( typeof str === 'string' )
        return str.replace(/^\x00+/g, '').replace(/\x00+$/g, '');    

    return str;
}

function toBuffer(guid){
    var words = guid.split('-')
      , string = '';

    _.each(words, function(word, idx){        
          string += idx <= 2 
            ? word.match(/.{2}/g).reverse().join('')
            : word;
    })

    return new Buffer(string, 'hex');
}

function toGuid(buffer){
    var str = buffer.toString('hex')
      , guid = (str.slice(6, 8));

    guid += (str.slice(4, 6));
    guid += (str.slice(2, 4));
    guid += (str.slice(0, 2));
    guid += (str.slice(10, 12));
    guid += (str.slice(8, 10));
    guid += (str.slice(14, 16));
    guid += (str.slice(12, 14));
    guid += (str.slice(16, 34));

    return "{" + (guid.slice(0, 8)) + "-" + (guid.slice(8, 12)) + "-" + (guid.slice(12, 16)) + "-" + (guid.slice(16, 20)) + "-" + (guid.slice(20, 34)) + "}";
}

var PIC_TYPES = [
    'Other',
    'pixels "file icon" (PNG only)',
    'Other file icon',
    'Cover (front)',
    'Cover (back)',
    'Leaflet page',
    'Media (e.g. label side of CD)',
    'Lead artist/lead performer/soloist',
    'Artist/performer',
    'Conductor',
    'Band/Orchestra',
    'Composer',
    'Lyricist/text writer',
    'Recording Location',
    'During recording',
    'During performance',
    'Movie/video screen capture',
    'A bright coloured fish',
    'Illustration',
    'Band/artist logotype',
    'Publisher/Studio logotype']