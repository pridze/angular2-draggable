import {ChangeDetectorRef, Component, ElementRef, AfterViewInit, ViewChild} from '@angular/core';

const DEFAULT_STAGE_WIDTH = 1000;

@Component({
  selector: 'app-basic',
  templateUrl: './basic.component.html',
  styleUrls: ['./basic.component.scss']
})
export class BasicComponent implements AfterViewInit {
  stageZoom = 1;
  movingOffset = { x: 0, y: 0 };
  endOffset = { x: 0, y: 0 };
  @ViewChild('StageContainer') container: ElementRef;

  constructor(private cdr: ChangeDetectorRef) { }

  ngAfterViewInit() {
    this._getStageScale(this.container.nativeElement.clientWidth);
  }

  onWindowResize(stage) {
    this._getStageScale(stage.clientWidth);
  }

  onStart(event) {
    console.log('started output:', event);
  }

  onStop(event) {
    console.log('stopped output:', event);
  }

  onMoving(event) {
    this.movingOffset.x = Math.floor(event.x);
    this.movingOffset.y = Math.floor(event.y);
  }

  onMoveEnd(event) {
    this.endOffset.x = Math.floor(event.x);
    this.endOffset.y = Math.floor(event.y);
  }

  private _getStageScale(clientWidth) {
    this.stageZoom = clientWidth / DEFAULT_STAGE_WIDTH;
    console.log(this.stageZoom);
    this.cdr.detectChanges();
  }
}
