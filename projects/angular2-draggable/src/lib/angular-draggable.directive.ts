import {
  Directive, ElementRef, Renderer2,
  Input, Output, OnInit,
  EventEmitter, OnChanges, SimpleChanges,
  OnDestroy, AfterViewInit, NgZone
} from '@angular/core';

import { IPosition, Position } from './models/position';
import { HelperBlock } from './widgets/helper-block';

@Directive({
  selector: '[ngDraggable]',
  exportAs: 'ngDraggable'
})
export class AngularDraggableDirective implements OnInit, OnDestroy, OnChanges, AfterViewInit {
  private allowDrag = true;
  private moving = false;
  private orignal: Position = null;
  private oldTrans = new Position(0, 0);
  private tempTrans = new Position(0, 0);
  private currTrans = new Position(0, 0);
  private oldZIndex = '';
  private _zIndex = '';
  private needTransform = false;
  private _removeListener1: () => void;
  private _removeListener2: () => void;
  private _removeListener3: () => void;
  private _removeListener4: () => void;
  private _isGridSnapEnabled = false;

  /**
   * Bugfix: iFrames, and context unrelated elements block all events, and are unusable
   * https://github.com/xieziyu/angular2-draggable/issues/84
   */
  private _helperBlock: HelperBlock = null;

  @Output() started = new EventEmitter<any>();
  @Output() stopped = new EventEmitter<any>();
  @Output() edge = new EventEmitter<any>();

  /** Make the handle HTMLElement draggable */
  @Input() handle: HTMLElement;

  /** Set the bounds HTMLElement */
  @Input() bounds: HTMLElement;

  /** List of allowed out of bounds edges **/
  @Input() outOfBounds = {
    top: false,
    right: false,
    bottom: false,
    left: false
  };

  /** Round the position to nearest grid */
  @Input() gridSize = 1;

  /** Set z-index when dragging */
  @Input() zIndexMoving: string;

  /** Set z-index when not dragging */
  @Input() set zIndex(setting: string) {
    this.renderer.setStyle(this.el.nativeElement, 'z-index', setting);
    this._zIndex = setting;
  }
  /** Whether to limit the element stay in the bounds */
  @Input() inBounds = false;

  /** Whether the element should use it's previous drag position on a new drag event. */
  @Input() trackPosition = true;

  /** Input css scale transform of element so translations are correct */
  @Input() scale = 1;

  /** Whether to prevent default event */
  @Input() preventDefaultEvent = false;

  /** Set initial position by offsets */
  @Input() position: IPosition = { x: 0, y: 0 };

  /** Emit position offsets when moving */
  @Output() movingOffset = new EventEmitter<IPosition>();

  /** Emit position offsets when put back */
  @Output() endOffset = new EventEmitter<IPosition>();

  @Input()
  set ngDraggable(setting: any) {
    if (setting !== undefined && setting !== null && setting !== '') {
      this.allowDrag = !!setting;

      let element = this.handle ? this.handle : this.el.nativeElement;

      if (this.allowDrag) {
        this.renderer.addClass(element, 'ng-draggable');
      } else {
        this.renderer.removeClass(element, 'ng-draggable');
      }
    }
  }

  constructor(private el: ElementRef,
              private renderer: Renderer2,
              private zone: NgZone) {
    this._helperBlock = new HelperBlock(el.nativeElement, renderer);
  }

  ngOnInit() {
    this._bindEvents();

    if (this.allowDrag) {
      let element = this.handle ? this.handle : this.el.nativeElement;
      this.renderer.addClass(element, 'ng-draggable');
    }

    this.resetPosition();
  }

  ngOnDestroy() {
    this.bounds = null;
    this.handle = null;
    this.orignal = null;
    this.oldTrans = null;
    this.tempTrans = null;
    this.currTrans = null;
    this._helperBlock.dispose();
    this._helperBlock = null;
    this._removeListener1();
    this._removeListener2();
    this._removeListener3();
    this._removeListener4();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['position'] && !changes['position'].isFirstChange()) {
      let p = changes['position'].currentValue;

      if (!this.moving) {
        if (Position.isIPosition(p)) {
          this.oldTrans.set(p);
        } else {
          this.oldTrans.reset();
        }

        this.transform();
      } else {
        this.needTransform = true;
      }
    }
  }

  ngAfterViewInit() {
    if (this.inBounds) {
      this.boundsCheck();
      this.oldTrans.add(this.tempTrans);
      this.tempTrans.reset();
    }
  }

  resetPosition() {
    if (Position.isIPosition(this.position)) {
      this.oldTrans.set(this.position);
    } else {
      this.oldTrans.reset();
    }
    this.tempTrans.reset();
    this.transform();
  }

  private moveTo(p: Position) {
    if (this.orignal) {
      p.subtract(this.orignal);
      this.tempTrans.set({x: p.x / this.scale, y: p.y / this.scale});
      this.transform();

      if (this.bounds) {
        this.zone.run(() => this.edge.emit(this.boundsCheck()));
      }

      this.zone.run(() => this.movingOffset.emit(this.currTrans.value));
    }
  }

  private transform() {

    let translateX = this.tempTrans.x + this.oldTrans.x;
    let translateY = this.tempTrans.y + this.oldTrans.y;

    // Snap to grid: by grid size
    if (this.gridSize > 1 && this._isGridSnapEnabled) {
      translateX = Math.round(translateX / this.gridSize) * this.gridSize;
      translateY = Math.round(translateY / this.gridSize) * this.gridSize;
    }

    let value = `translate(${translateX}px, ${translateY}px)`;

    this.renderer.setStyle(this.el.nativeElement, 'transform', value);
    this.renderer.setStyle(this.el.nativeElement, '-webkit-transform', value);
    this.renderer.setStyle(this.el.nativeElement, '-ms-transform', value);
    this.renderer.setStyle(this.el.nativeElement, '-moz-transform', value);
    this.renderer.setStyle(this.el.nativeElement, '-o-transform', value);

    // save current position
    this.currTrans.x = translateX;
    this.currTrans.y = translateY;
  }

  private pickUp() {
    // get old z-index:
    this.oldZIndex = this.el.nativeElement.style.zIndex ? this.el.nativeElement.style.zIndex : '';

    if (window) {
      this.oldZIndex = window.getComputedStyle(this.el.nativeElement, null).getPropertyValue('z-index');
    }

    if (this.zIndexMoving) {
      this.renderer.setStyle(this.el.nativeElement, 'z-index', this.zIndexMoving);
    }

    if (!this.moving) {
      this.zone.run(() => this.started.emit(this.el.nativeElement));
      this.moving = true;
    }
  }

  boundsCheck() {
    if (this.bounds) {
      let boundary = this.bounds.getBoundingClientRect();
      let elem = this.el.nativeElement.getBoundingClientRect();
      let result = {
        'top': this.outOfBounds.top ? true : boundary.top < elem.top,
        'right': this.outOfBounds.right ? true : boundary.right > elem.right,
        'bottom': this.outOfBounds.bottom ? true : boundary.bottom > elem.bottom,
        'left': this.outOfBounds.left ? true : boundary.left < elem.left
      };

      if (this.inBounds) {
        if (!result.top) {
          this.tempTrans.y -= (elem.top - boundary.top) / this.scale;
        }

        if (!result.bottom) {
          this.tempTrans.y -= (elem.bottom - boundary.bottom) / this.scale;
        }

        if (!result.right) {
          this.tempTrans.x -= (elem.right - boundary.right) / this.scale;
        }

        if (!result.left) {
          this.tempTrans.x -= (elem.left - boundary.left) / this.scale;
        }

        this.transform();
      }

      return result;
    }
  }

  /** Get current offset */
  getCurrentOffset() {
    return this.currTrans.value;
  }

  private putBack() {
    if (this._zIndex) {
      this.renderer.setStyle(this.el.nativeElement, 'z-index', this._zIndex);
    } else if (this.zIndexMoving) {
      if (this.oldZIndex) {
        this.renderer.setStyle(this.el.nativeElement, 'z-index', this.oldZIndex);
      } else {
        this.el.nativeElement.style.removeProperty('z-index');
      }
    }

    if (this.moving) {
      this.zone.run(() => this.stopped.emit(this.el.nativeElement));

      // Remove the helper div:
      this._helperBlock.remove();

      if (this.needTransform) {
        if (Position.isIPosition(this.position)) {
          this.oldTrans.set(this.position);
        } else {
          this.oldTrans.reset();
        }

        this.transform();
        this.needTransform = false;
      }

      if (this.bounds) {
        this.zone.run(() => this.edge.emit(this.boundsCheck()));
      }

      this.moving = false;
      this.zone.run(() => this.endOffset.emit(this.currTrans.value));

      if (this.trackPosition) {
        this.oldTrans.add(this.tempTrans);
      }

      this.tempTrans.reset();

      if (!this.trackPosition) {
        this.transform();
      }
    }
  }

  checkHandleTarget(target: EventTarget, element: Element) {
    // Checks if the target is the element clicked, then checks each child element of element as well
    // Ignores button clicks

    // Ignore elements of type button
    if (element.tagName === 'BUTTON') {
      return false;
    }

    // If the target was found, return true (handle was found)
    if (element === target) {
      return true;
    }

    // Recursively iterate this elements children
    for (let child in element.children) {
      if (element.children.hasOwnProperty(child)) {
        if (this.checkHandleTarget(target, element.children[child])) {
          return true;
        }
      }
    }

    // Handle was not found in this lineage
    // Note: return false is ignore unless it is the parent element
    return false;
  }

  private _bindEvents() {
    this.zone.runOutsideAngular(() => {
      this._removeListener1 = this.renderer.listen(this.el.nativeElement, 'mousedown', (event: MouseEvent | TouchEvent) => {
        // 1. skip right click;
        if (event instanceof MouseEvent && event.button === 2) {
          return;
        }
        // 2. if handle is set, the element can only be moved by handle
        let target = event.target || event.srcElement;
        if (this.handle !== undefined && !this.checkHandleTarget(target, this.handle)) {
          return;
        }

        if (this.preventDefaultEvent) {
          event.stopPropagation();
          event.preventDefault();
        }

        this.orignal = Position.fromEvent(event);
        this.pickUp();
      });
      this._removeListener2 = this.renderer.listen('document', 'mouseup', () => {
        this.putBack();
      });
      this._removeListener3 = this.renderer.listen('document', 'mouseleave', () => {
        this.putBack();
      });
      this._removeListener4 = this.renderer.listen('document', 'mousemove', (event: MouseEvent | TouchEvent) => {
        if (this.moving && this.allowDrag) {
          if (this.preventDefaultEvent) {
            event.stopPropagation();
            event.preventDefault();
          }

          // Only when shift key is pressed
          this._isGridSnapEnabled =  !!event.shiftKey;

          // Add a transparent helper div:
          this._helperBlock.add();
          this.moveTo(Position.fromEvent(event));
        }
      });
    });
  }
}
