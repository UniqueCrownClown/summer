// 1
//interface Desc {
//  set:()=>void
// get:()=>string
//}
//Object.defineProperty(obj:object(目标对象), prop:string(定义的属性), desc:Desc(属性描述符))

// 2
// Object.keys(obj)
// Object.keys(obj).forEach(key => {
//  console.log(key, obj[key])
// })

// 3
// Node.nodeType
// 1 代表元素节点；2 代表属性节点；3 代表文本节点

// 4
// 正则表达式
//点.匹配除“\n”和"\r"之外的任何单个字符。
//要匹配包括“\n”和"\r"在内的任何字符，请使用像“[\s\S]”的模 

// class Vue {
//   constructor(options) {
//     let vm = this;
//     this.$options = options;
//     this._data = this.$options.data;
//     Object.keys(this._data).forEach(key => {
//       vm._proxy(key);
//     })
//   }
//   _proxy (key) {
//     let vm = this;
//     Object.defineProperty(vm, key, {
//       configurable: false,
//       enumerable: true,
//       get: () => vm._data[key],
//       set: newVal => (vm._data[key] = newVal)
//     })
//   }
// }

class Compile {
  constructor(el, vm) {
    this.$vm = vm;
    this.$el = document.querySelector(el);
    if (this.$el) {
      this.$fragment = this.createFragmentObj(this.$el);
      this.createVdom(this.$fragment);
      this.$el.appendChild(this.$fragment);
    }
  }

  // 创建fragment对象
  createFragmentObj (el) {
    let fragment = document.createDocumentFragment();
    let child;
    while (child = el.firstChild) {
      fragment.appendChild(child);
    }
    return fragment;
  }

  // 创建dom
  createVdom (fragment) {
    // 取出所有子节点
    let childNodes = fragment.childNodes;
    Array.prototype.slice.call(childNodes).forEach(childNode => {
      // 取出文本节点
      let text = childNode.textContent;
      // 匹配出大括号表达式
      let reg = /\{\{(.*)\}\}/;
      // 根据节点类型分别编译
      // 如果是文本节点并且包含大括号表达式
      if (childNode.nodeType === 3 && reg.test(text)) {
        // 如果是文本节点
        this.compileText(childNode, RegExp.$1);
      } else if (childNode.nodeType === 1 && !childNode.hasChildNodes()) {
        // 如果是dom节点且没有子元素
        this.compileInnerHTML(childNode);
      } else if (childNode.nodeType === 1 && childNode.hasChildNodes()) {
        // 如果是dom节点并且还有子元素就调用createVdom回到上面(其实这是递归的方法)
        this.createVdom(childNode);
      }
    });
  }

  // 编译innerHTML节点
  // compileInnerHTML (node) {
  //   Object.keys(node.attributes).forEach(key => {
  //     let exp = node.attributes[key]["nodeValue"];
  //     let val = this.$vm[node.attributes[key]["nodeValue"]];
  //     // 普通指令渲染
  //     switch (node.attributes[key]["nodeName"]) {
  //       case "v-text":
  //         this.updataDomVal(node, exp, "textContent", val);
  //         break;
  //       case "v-html":
  //         this.updataDomVal(node, exp, "innerHTML", val);
  //         break;
  //     }
  //   });
  // }

  compileInnerHTML (node) {
    Object.keys(node.attributes).forEach(key => {
      // 事件指令解析
      if (node.attributes[key]["nodeName"].search("v-on") != -1) {
        // 获取事件类型
        let eventType = node.attributes[key]["nodeName"].split(":")[1];
        // 获取事件名称
        let eventName = node.attributes[key]["nodeValue"];
        // 在methods中寻找绑定的方法
        let event = this.$vm.$options.methods[eventName];
        // 给当前节点添加相应事件
        node.addEventListener(eventType, () => {
          // 将事件中的this指定为vm实例
          event.bind(this.$vm)();
        });
        // 执行完之后移除相应事件
        node.removeEventListener(eventType, () => {
          event.bind(this.$vm)();
        });
      }
    })
  }


  // 编译文本节点
  compileText (node, temp) {
    this.updataDomVal(node, temp, "textContent", this.$vm[temp]);
  }

  // 更新节点
  updataDomVal (node, exp, domType, domValue) {
    // 你不懂Watcher类没关系，先忽略这些，后面会慢慢讲到这个类
    // 标记每个使用data属性对象的dom节点位置, 并一直监听，当有变化时，会被dep实例捕获
    new Watcher(this.$vm, node, exp, (newVal, oldVal) => {
      node[domType] = newVal;
    });
    // 这里是具体的赋值
    node[domType] = domValue;
  }



}

// 这个标志是为了保存watcher实例
//Dep.target = null
// 创建依赖类，捕获每个监听点的变化
class Dep {
  constructor() {
    this.subList = [];
  }
  // 建立依赖给dep和watcher
  depend () {
    Dep.target.addDep(this)
  }
  // 添加watcher到sublist中
  addSub (sub) {
    this.subList.push(sub)
  }
  // 通知所有watcher值改变了
  notify (newVal) {
    this.subList.forEach(sub => {
      sub.updata(newVal)
    })
  }
}

let uid = 0;
// 创建监听类，监听每个渲染数据地方
class Watcher {
  constructor(vm, node, exp, callback) {
    // 每个watcher的唯一标识
    this.uid = uid++;
    this.$vm = vm;
    // 每个watcher监听节点
    this.node = node;
    // 每个watcher监听节点的属性名称表达式
    this.exp = exp;
    // 每个watcher监听节点的回调函数
    this.callback = callback;
    // 每个watcher监听的节点列表
    this.depList = {};
    // 每个监听节点的初始值
    this.value = this.getVal();
  }
  addDep (dep) {
    if (!this.depList.hasOwnProperty(dep.uid)) {
      dep.addSub(this);
    }
  }
  updata (newVal) {
    this.callback.call(this.$vm, newVal, this.value)
  }
  getVal () {
    // 获取值时将当前watcher指向Dep.target，方便在数据劫持get函数里建立依赖关系
    Dep.target = this;
    // 获取当前节点位置值
    let val = this.$vm[this.exp];
    // 获取完之后将Dep.target设置为null
    Dep.target = null;
    return val;
  }
}

// 创建观察者类，观察data属性的变化
class Observer {
  constructor(data, vm) {
    this.data = data;
    this.$vm = vm;
    this.walk();
  }
  walk () {
    Object.keys(this.data).forEach(key => {
      this.defineReactive(key, this.data[key]);
    })
  }
  defineReactive (key, val) {
    // 每个属性实例化dep对象，存放它所有的监听者
    let dep = new Dep();
    // 重新定义data对象的属性，以便给属性添加get方法和set方法
    Object.defineProperty(this.data, key, {
      configurable: false,
      enumerable: true,
      get: () => {
        if (Dep.target) {
          dep.depend();
        }
        return val;
      },
      set: (newVal) => {
        if (val !== newVal) {
          dep.notify(newVal);
        }
        val = newVal;
        return
      }
    })
  }
}

class Vue {
  constructor(options) {
    let vm = this;
    this.$options = options;
    this._data = this.$options.data;
    this.proxy = (key) => {
      let vm = this;
      Object.defineProperty(vm, key, {
        configurable: false,
        enumerable: true,
        get: () => vm._data[key],
        set: newVal => (vm._data[key] = newVal)
      })
    }
    // 代理data中的每个属性
    Object.keys(this._data).forEach(key => {
      vm.proxy(key);
    });
    // 劫持data中的属性，当值发生变化时重新编译变化的节点
    new Observer(this._data, vm)
    // 编译节点到页面
    this.$compile = new Compile(
      this.$options.el ? this.$options.el : document.body,
      vm
    );
  }
}
