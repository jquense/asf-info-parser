'use strict';

exports.bufferEqual = function ( a, b ){
    if ( !Buffer.isBuffer(a) || !Buffer.isBuffer(b) ) return false 
    if ( a.length !== b.length ) return false 
    var i = 0;

    for(; i < a.length; ++i)
        if ( a[i] !== b[i] ) return false

    return true
}

exports.indexOf = function (buf, sub, fromIndex, chunked){
    var idx = fromIndex || 0
      , len = buf.length
      , chnkSize = sub.length;

    for (; idx < len; idx += chunked ? chnkSize : 1 ){
        if ( exports.bufferEqual(buf.slice(idx, idx + chnkSize), sub) )
            return idx;    
    }

    return -1;
}

exports.decodeString = function (buf, encoding, start, end) {
    start = start || 0;
    end   = end   || buf.length;

    if ( start > end)
        debugger;

    return encoding == 'utf16' 
        ? exports.toUtf16String( buf, start, end ) 
        : buf.toString( encoding == 'iso-8859-1' ? 'binary' : 'utf8', start, end );
}


exports.toUtf16String = function (buf, start, end) {
    start = start || 0
    end   = end   || buf.length

    if (buf[start] === 0xFE && buf[start + 1 ] === 0xFF) //BE the 16 bit chunks need to switch order (fake LE)
        buf = toUtf16LE(buf.slice(start, end));
  
    return buf
        .toString('utf16le', start, end)
        .replace(/^\uFEFF/, '');
}

exports.toUtf16LE = function (buff) {
  var len = buffer.length;

  if (len & 0x01) throw new Error('Buffer length must be even');
  
  for (var i = 0; i < len; i += 2) {
    var tmp = buff[i];

    buff[i] = buff[i + 1];
    buff[i + 1] = tmp;
  }
  return buff;
}
