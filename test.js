// UnitTest.js 
var chai = require('chai')
  , sinon = require('sinon')
  , sinonChai = require('sinon-chai')
  , PassThrough = require('stream').PassThrough
  , ASF = require('./asf-parser');

chai.use(sinonChai);
chai.should();

describe("when parsing an audio file", function(){
    var parser, src;

    beforeEach(function(){
        src = new PassThrough();
        parser = new ASF()
          
        src.pipe(parser)  
    })

    it( 'should fail if not an asf file', function(done){

        parser.on('error', function(err){
            err.should.be.an.instanceOf(Error)
            err.message.should.equal('not an asf file')
            done() 
        })

        src.write(new Buffer('i\'m not an asf file', 'utf8')) 
    })
    
    describe('when parsing a proper asf file', function(){
        
        beforeEach(function(){
            src = require('fs').createReadStream('./test.wma')
            parser = new ASF()
            
            src.pipe(parser);

            sinon.spy(parser, 'isHeaderGuid')
            sinon.spy(parser, 'parseHeader')
        })
        
        it('should start searching for a header', function(done){
            
            parser.on('end', function(){
                parser.isHeaderGuid.should.have.been.called
                done()    
            })

            readToEnd(parser);
        })

        it('should start parsing headers', function(done){
            
            parser.on('end', function(){
                parser.isHeaderGuid.should.have.been.calledBefore(parser.parseHeader)
                parser.parseHeader.should.have.been.called
                done()    
            })

            readToEnd(parser);
        })

        it('should emit the correct tags', function(done){
            var tags = {};

            parser
                .on('data', function(t){
                    tags[t.type] = t.value;
                })
                .on('end', function(){
                    tags.should.have.property('duration' ).that.is.closeTo(10, 0.1)
                    tags.title.should.equal('Silence')
                    tags.author.should.equal('Dummy')
                    tags.desc.should.equal('a comment!')
                    tags["WM/AlbumTitle"].should.equal('10 seconds of Silence')
                    tags["WM/TrackNumber"].should.equal('1')
                    tags["WM/Year"].should.equal('2014')
                    tags["WM/Picture"].should.have.deep.property('data.length' ).that.equals(23867)
                    done()
                })
        })
    })
})

function readToEnd(str){
    
    str.on('readable', function(){
        while( null !== str.read() ){}
    })    
}