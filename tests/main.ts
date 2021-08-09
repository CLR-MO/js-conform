// mocha app/Conform/tests/main.js
import 'mocha'
import chai  from 'chai'
import Conform from '../src/index'

chai.config.includeStack = true;
const expect = chai.expect

const delayed_promise = (v:any = false)=>{
  return new Promise((resolve) => { setTimeout((() => { resolve(v) }), 200) })
}

//require(__dirname + '/../main.coffee')
const conformer = {
  pass: function(v) {
    return v;
  },
  delay_pass: function(v) {
    return delayed_promise(v)
  },
  mutate: function(v) {
    return v + 'bob';
  },
  delay_mutate: function(v) {
    return delayed_promise(v + 'bob')
  },
  reject: function(v) {
    throw new Error('fail');
  },
  delay_reject: function(v) {
    return delayed_promise().then(() => {throw new Error('fail')})
  }
};

const newConform = (input)=>{
  return new Conform(input, { conformers: {'test_fn': conformer}})
}
console.log('wt2f')
/*
conform = new Conform({test1:'moe', test2:'sue'})
rules =
  test1:'~test_fn.delay_reject &test_fn.delay_mutate'
  test2:'test_fn.delay_mutate'
conform.get(rules).then (o)->
  c o
  c conform.errors
*/
//###
describe("Test Suite", function() {
  // Avoid the mocha default suite timeout by setting it higher
  this.timeout(1000);
  it("rules string separation", function() {
    const conform = new Conform
    return expect(conform.compile_rules('bob|bob| bob |bob | bob').length).to.equal(5);
  });
  describe("testing compile_rules", function() {
    const conform = new Conform
    it('!a.string', function() {
      return expect(conform.compile_rule('!a.string')).to.deep.equal({
        flags: {
          break: true
        },
        params: [],
        fn_path: 'a.string'
      });
    });
    it('!!a.string', function() {
      return expect(conform.compile_rule('!!a.string')).to.deep.equal({
        flags: {
          break_all: true
        },
        params: [],
        fn_path: 'a.string'
      });
    });
    it('?!a.above:10', function() {
      return expect(conform.compile_rule('?!a.above:10')).to.deep.equal({
        flags: {
          optional: true,
          break: true
        },
        params: ['10'],
        fn_path: 'a.above'
      });
    });
    it('?!a.above:10,20', function () {
      return expect(conform.compile_rule('?!a.above:10,20')).to.deep.equal({
        flags: {
          optional: true,
          break: true
        },
        params: ['10', '20'],
        fn_path: 'a.above'
      });
    });
    it('testing ?!a.above:10,20 | a.above:5', function () {
      return expect(conform.compile_rules('?!a.above:10,20 | a.above:5')).to.deep.equal(
        [
          {
            flags: {
              optional: true,
              break: true
            },
            params: ['10', '20'],
            fn_path: 'a.above'
          },
          {
            flags: {},
            params: ['5'],
            fn_path: 'a.above'
          }
        ]
        );
    });

    return it('~?&&a.function', function() {
      return expect(conform.compile_rule('~?&&a.function')).to.deep.equal({
        flags: {
          full_continuity: true,
          not: true,
          optional: true
        },
        params: [],
        fn_path: 'a.function'
      });
    });
  });
  return describe("validation", function() {
    it('mutate', async function() {
      let conform = newConform({
        test1: 'moe',
        test2: 'sue'
      });
      let o = await conform.get({
        test1: 'test_fn.pass | test_fn.mutate',
        test2: 'test_fn.pass | test_fn.mutate'
      })
      expect(o).to.deep.equal({
          test1: 'moebob',
          test2: 'suebob'})
        
      
    });
    it('mutates', async function() {
      var conform = newConform({
        test1: 'moe',
        test2: 'sue'
      });
      let o = await conform.get({
        test1: 'test_fn.pass | test_fn.mutate | test_fn.mutate',
        test2: 'test_fn.pass | test_fn.mutate | test_fn.mutate'
      })
      console.log(o)
        expect(o).to.deep.equal({
          test1: 'moebobbob',
          test2: 'suebobbob'
        });
    });
    it('delayed_mutates', async function() {
      var conform = newConform({
        test1: 'moe',
        test2: 'sue'
      });
      let o = await conform.get({
        test1: 'test_fn.pass | test_fn.delay_mutate | test_fn.delay_mutate',
        test2: 'test_fn.pass | test_fn.delay_mutate | test_fn.delay_mutate'
      })
        expect(o).to.deep.equal({
          test1: 'moebobbob',
          test2: 'suebobbob'
        });
        
    });
    it('reject', async function() {
      var conform = newConform({
        test1: 'moe',
        test2: 'sue'
      });
      let rules = {
        test1: 'test_fn.pass | test_fn.reject | test_fn.delay_mutate',
        test2: 'test_fn.pass | test_fn.reject | test_fn.delay_mutate'
      };
      let o = await conform.get(rules)
      
        expect(conform.errors.length).to.equal(2);
        expect(conform.field_errors.test1.length).to.equal(1);
        expect(conform.field_errors.test2.length).to.equal(1);
        
    });
    it('delayed reject', async function() {
      var conform = newConform({
        test1: 'moe',
        test2: 'sue'
      });
      let rules = {
        test1: 'test_fn.pass | test_fn.delay_reject | test_fn.delay_mutate',
        test2: 'test_fn.pass | test_fn.delay_reject | test_fn.delay_mutate'
      };
      let o = await  conform.get(rules)
        expect(conform.errors.length).to.equal(2);
        expect(conform.field_errors.test1.length).to.equal(1);
        expect(conform.field_errors.test2.length).to.equal(1);
        
    });
    it('optional reject', async function() {
      var conform = newConform({
        test1: 'moe',
        test2: 'sue'
      });
      let rules = {
        test1: 'test_fn.pass | ?test_fn.reject | test_fn.delay_mutate',
        test2: 'test_fn.pass | ?test_fn.reject | test_fn.delay_mutate'
      };
      let o = await conform.get(rules)
        expect(o).to.deep.equal({
          test1: 'moebob',
          test2: 'suebob'
        });
        expect(conform.errors.length).to.equal(0);
        
    });
    it('optional delayed reject', async function() {
      var conform = newConform({
        test1: 'moe',
        test2: 'sue'
      });
      let rules = {
        test1: 'test_fn.pass | ?test_fn.delay_reject | test_fn.delay_mutate',
        test2: 'test_fn.pass | ?test_fn.delay_reject | test_fn.delay_mutate'
      };
      let o = await  conform.get(rules)
        expect(o).to.deep.equal({
          test1: 'moebob',
          test2: 'suebob'
        });
        expect(conform.errors.length).to.equal(0);
        
      
    });
    it('full continuity without error', async function() {
      var conform = newConform({
        test1: 'moe',
        test2: 'sue'
      });
      let rules = {
        test1: '?!test_fn.reject',
        test2: '&&test_fn.delay_mutate'
      };
      let o = await conform.get(rules)
        expect(o).to.deep.equal({
          test2: 'suebob'
        });
        
    });
    it('full continuity with error', async function() {
      var conform = newConform({
        test1: 'moe',
        test2: 'sue'
      });
      let rules = {
        test1: '!test_fn.reject',
        test2: '&&test_fn.delay_mutate'
      };
      let o = await conform.get(rules)
        expect(o).to.deep.equal({});
        
    });
    it('full continuity with delayed error', async function() {
      var conform = newConform({
        test1: 'moe',
        test2: 'sue'
      });
      let rules = {
        test1: '!test_fn.delay_reject',
        test2: '&&test_fn.delay_mutate'
      };
      let o = await conform.get(rules)
        expect(o).to.deep.equal({});
        
      
    });
    it('continuity with delayed error', async function() {
      var conform = newConform({
        test1: 'moe',
        test2: 'sue'
      });
      let rules = {
        test1: 'test_fn.delay_reject | &test_fn.delay_mutate',
        test2: 'test_fn.delay_mutate'
      };
      let o = await conform.get(rules)
        expect(o).to.deep.equal({
          test2: 'suebob'
        });
        expect(conform.field_errors.test1.length).to.equal(1);
        
    });
    it('not-ed delayed error with continuity', async function() {
      var conform = newConform({
        test1: 'moe',
        test2: 'sue'
      });
      let rules = {
        test1: '~test_fn.delay_reject | &test_fn.delay_mutate',
        test2: 'test_fn.delay_mutate'
      };
      let o = await conform.get(rules)
        expect(o).to.deep.equal({
          test1: 'moebob',
          test2: 'suebob'
        });
        expect(conform.errors.length).to.equal(0);
        
    });
    return it('break all', async function() {
      var conform = newConform({
        test1: 'moe',
        test2: 'sue'
      });
      let rules = {
        test1: '!!test_fn.delay_reject',
        test2: 'test_fn.delay_mutate'
      };
      let o = await  conform.get(rules)
        expect(o).to.deep.equal({});
        expect(conform.errors.length).to.equal(1);
        
    });
  });
});
