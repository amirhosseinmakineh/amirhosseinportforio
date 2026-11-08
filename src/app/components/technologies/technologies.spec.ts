import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SkillsComponent as Technologies } from './technologies';

describe('Technologies', () => {
  let component: Technologies;
  let fixture: ComponentFixture<Technologies>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Technologies]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Technologies);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
